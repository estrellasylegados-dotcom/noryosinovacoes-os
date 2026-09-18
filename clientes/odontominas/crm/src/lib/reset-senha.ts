import { createHash, randomBytes } from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase";
import { hashSenha } from "@/lib/senha";
import { normalizarEmail, bumpSessaoVersao, buscarAtendenteCompletoPorId } from "@/lib/atendentes";
import { registrarEvento } from "@/lib/auditoria";

/** Validade curta (seção 28 do pedido): 30 min, uso único. */
const VALIDADE_MS = 30 * 60 * 1000;

function gerarTokenBruto(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(tokenBruto: string): string {
  return createHash("sha256").update(tokenBruto).digest("hex");
}

/**
 * Sempre chamar mesmo quando o e-mail não existe (a rota devolve a mesma
 * resposta genérica nos dois casos — seção 27). `null` = não achou conta
 * ativa com esse e-mail; a rota não deve tratar isso como erro visível.
 */
export async function solicitarResetSenha(email: string): Promise<{ atendenteId: string; nome: string; tokenBruto: string } | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("atendentes")
    .select("id, nome, status")
    .eq("email", normalizarEmail(email))
    .maybeSingle();

  if (!data || data.status !== "active") return null;

  const tokenBruto = gerarTokenBruto();
  const { error } = await supabase.from("password_reset_tokens").insert({
    atendente_id: data.id,
    token_hash: hashToken(tokenBruto),
    expires_at: new Date(Date.now() + VALIDADE_MS).toISOString(),
  });
  if (error) {
    console.error("[reset_senha] criar_token_failed", JSON.stringify({ code: error.code ?? null }));
    return null;
  }

  await registrarEvento({ atorId: data.id as string, evento: "PASSWORD_RESET_REQUESTED", alvoId: data.id as string, detalhes: {} });

  return { atendenteId: data.id as string, nome: data.nome as string, tokenBruto };
}

export type ResultadoReset =
  | { ok: true; atendenteId: string; nome: string; email: string | null }
  | { ok: false; error: "senha_muito_curta" | "token_invalido" | "token_ja_usado" | "token_expirado" | "backend_unavailable" | "persist_failed" };

/** Troca a senha, revoga todas as sessões existentes e invalida outros tokens de reset pendentes (seção 28). */
export async function redefinirSenha(tokenBruto: string, novaSenha: string): Promise<ResultadoReset> {
  if (novaSenha.length < 8) return { ok: false, error: "senha_muito_curta" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data: registro, error } = await supabase
    .from("password_reset_tokens")
    .select("id, atendente_id, expires_at, used_at")
    .eq("token_hash", hashToken(tokenBruto))
    .maybeSingle();

  if (error || !registro) return { ok: false, error: "token_invalido" };
  if (registro.used_at) return { ok: false, error: "token_ja_usado" };
  if (new Date(registro.expires_at as string).getTime() < Date.now()) return { ok: false, error: "token_expirado" };

  const atendenteId = registro.atendente_id as string;

  const { error: updateError } = await supabase.from("atendentes").update({ senha_hash: hashSenha(novaSenha) }).eq("id", atendenteId);
  if (updateError) return { ok: false, error: "persist_failed" };

  await supabase
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("atendente_id", atendenteId)
    .is("used_at", null);

  await bumpSessaoVersao(atendenteId);

  const atendente = await buscarAtendenteCompletoPorId(atendenteId);
  await registrarEvento({
    clinicaId: atendente?.clinicaId ?? null,
    atorId: atendenteId,
    evento: "PASSWORD_RESET_COMPLETED",
    alvoId: atendenteId,
    detalhes: {},
  });

  return { ok: true, atendenteId, nome: atendente?.nome ?? "", email: atendente?.email ?? null };
}
