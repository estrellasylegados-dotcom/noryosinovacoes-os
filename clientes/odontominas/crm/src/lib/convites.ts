import { createHash, randomBytes } from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase";
import { hashSenha } from "@/lib/senha";
import { registrarEvento } from "@/lib/auditoria";
import { buscarAtendenteCompletoPorId } from "@/lib/atendentes";

/** Validade do convite (seção 26 do pedido): 24h, uso único, só o hash persiste. */
const VALIDADE_MS = 24 * 60 * 60 * 1000;

function gerarTokenBruto(): string {
  return randomBytes(32).toString("hex");
}

function hashToken(tokenBruto: string): string {
  return createHash("sha256").update(tokenBruto).digest("hex");
}

/** Devolve o token em texto puro só pra quem chamou montar o e-mail (src/lib/email.ts) — nunca persiste. */
export async function criarConvite(atendenteId: string, criadoPorId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const tokenBruto = gerarTokenBruto();
  const { error } = await supabase.from("convites").insert({
    atendente_id: atendenteId,
    token_hash: hashToken(tokenBruto),
    expires_at: new Date(Date.now() + VALIDADE_MS).toISOString(),
    created_by: criadoPorId,
  });

  if (error) {
    console.error("[convites] criar_failed", JSON.stringify({ code: error.code ?? null }));
    return null;
  }
  return tokenBruto;
}

export type ResultadoAceiteConvite = { ok: true } | { ok: false; error: "senha_muito_curta" | "token_invalido" | "token_ja_usado" | "token_expirado" | "backend_unavailable" | "persist_failed" };

/** Fluxo self-service: token válido define a senha e ativa a conta (seção 17 do pedido — sem aprovação redundante, a criação pela Dona/Noryos Admin já é a aprovação). */
export async function aceitarConvite(tokenBruto: string, novaSenha: string): Promise<ResultadoAceiteConvite> {
  if (novaSenha.length < 8) return { ok: false, error: "senha_muito_curta" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data: convite, error } = await supabase
    .from("convites")
    .select("id, atendente_id, expires_at, used_at")
    .eq("token_hash", hashToken(tokenBruto))
    .maybeSingle();

  if (error || !convite) return { ok: false, error: "token_invalido" };
  if (convite.used_at) return { ok: false, error: "token_ja_usado" };
  if (new Date(convite.expires_at as string).getTime() < Date.now()) return { ok: false, error: "token_expirado" };

  const atendenteId = convite.atendente_id as string;

  const { error: updateError } = await supabase
    .from("atendentes")
    .update({ senha_hash: hashSenha(novaSenha), status: "active", ativo: true })
    .eq("id", atendenteId);
  if (updateError) return { ok: false, error: "persist_failed" };

  // Uso único + invalida qualquer outro convite pendente da mesma conta
  // (ex.: reenvio de convite antes do 1º expirar) numa só query.
  await supabase.from("convites").update({ used_at: new Date().toISOString() }).eq("atendente_id", atendenteId).is("used_at", null);

  const atendente = await buscarAtendenteCompletoPorId(atendenteId);
  await registrarEvento({
    clinicaId: atendente?.clinicaId ?? null,
    atorId: atendenteId,
    evento: "INVITE_ACCEPTED",
    alvoId: atendenteId,
    detalhes: {},
  });

  return { ok: true };
}
