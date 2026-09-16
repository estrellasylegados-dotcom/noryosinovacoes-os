import { getSupabaseServerClient } from "@/lib/supabase";

const PROVIDER = "controle_odonto";

export interface ResultadoLock {
  ok: boolean;
  holder?: string;
  error?: string;
}

/**
 * Lock distribuído simples via `integration_locks` (chave primária composta
 * = exclusão mútua real no Postgres) — evita o cron e o botão "Sincronizar
 * agora" rodando juntos (Railway roda 1 container, mas nada impede 2
 * disparos simultâneos vindo de fontes diferentes). TTL evita lock preso
 * pra sempre se o processo cair no meio da sincronização.
 */
export async function adquirirLock(clinicaId: string, resource: string, ttlMs: number): Promise<ResultadoLock> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const agora = new Date();

  // Limpa lock expirado antes de tentar — não precisa ser atômico com o
  // insert seguinte: quem garante exclusão mútua de verdade é a chave
  // primária da tabela, não esta limpeza.
  await supabase
    .from("integration_locks")
    .delete()
    .eq("clinica_id", clinicaId)
    .eq("provider", PROVIDER)
    .eq("resource", resource)
    .lt("expires_at", agora.toISOString());

  const holder = crypto.randomUUID();
  const expiresAt = new Date(agora.getTime() + ttlMs);

  const { error } = await supabase.from("integration_locks").insert({
    clinica_id: clinicaId,
    provider: PROVIDER,
    resource,
    holder,
    locked_at: agora.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "ocupado" };
    console.error("[controle-odonto/lock] adquirir_failed", JSON.stringify({ resource, code: error.code ?? null }));
    return { ok: false, error: "lock_indisponivel" };
  }

  return { ok: true, holder };
}

export async function liberarLock(clinicaId: string, resource: string, holder: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  await supabase
    .from("integration_locks")
    .delete()
    .eq("clinica_id", clinicaId)
    .eq("provider", PROVIDER)
    .eq("resource", resource)
    .eq("holder", holder);
}
