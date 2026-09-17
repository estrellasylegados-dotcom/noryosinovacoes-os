import { getSupabaseServerClient } from "@/lib/supabase";

const PROVIDER = "fluxo_conversa";

export interface ResultadoLock {
  ok: boolean;
  holder?: string;
  error?: string;
}

/**
 * Lock distribuído via `integration_locks` — mesmo mecanismo/tabela de
 * `src/lib/disparos-lock.ts`/`src/lib/controle-odonto/lock.ts` (chave
 * primária composta = exclusão mútua real no Postgres), só que com
 * `provider = 'fluxo_conversa'`. Provider é constante fixa do arquivo de
 * propósito (não importado de outro módulo) — garante que o worker do motor
 * de Fluxo de Conversa nunca roda 2 ciclos ao mesmo tempo pra uma clínica.
 */
export async function adquirirLock(clinicaId: string, resource: string, ttlMs: number): Promise<ResultadoLock> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const agora = new Date();

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
    console.error("[fluxo-lock] adquirir_failed", JSON.stringify({ resource, code: error.code ?? null }));
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
