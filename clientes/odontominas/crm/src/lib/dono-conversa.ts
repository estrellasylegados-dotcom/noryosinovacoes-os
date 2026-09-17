import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Arbitragem de quem responde uma conversa agora — Humano, Agente de IA ou
 * Fluxo de Conversa (Fase 2a do motor, ver crm/docs/fluxo-conversa-arquitetura.md).
 * Antes desta coluna, "humano é dono" era implícito (`agente_ativo_id is
 * null`) — quebra assim que existe um 3º candidato. `dono_conversa` é o
 * roteador explícito, checado ANTES de `agente_ativo_id`/`agente_pausado_ate`
 * (que não mudam em nada) e antes de `fluxo_execucao_ativa_id`.
 *
 * Módulo-folha de propósito: só importa `@/lib/supabase`, nunca importa de
 * volta `agentes.ts`/`etiquetas.ts`/`chat.ts`/`fluxo-execucoes.ts` — política
 * de quem pode assumir sobre quem (ex.: `fluxos.pode_interromper_agente_ia`)
 * fica sempre no chamador, nunca aqui.
 */

export type DonoConversa = "humano" | "agente_ia" | "fluxo";

/**
 * Assume a conversa pro dono indicado. `camposExtras` é mesclado na MESMA
 * `UPDATE` — preserva a atomicidade dos updates que já existiam antes desta
 * coluna (ex.: `retomarAgente` grava `agente_ativo_id`/`ultimo_agente_id`
 * junto), em vez de virar 2 queries separadas que poderiam desincronizar.
 */
export async function assumirControle(
  clinicaId: string,
  conversaId: string,
  dono: DonoConversa,
  camposExtras: Record<string, unknown> = {}
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { error } = await supabase
    .from("conversas")
    .update({ dono_conversa: dono, updated_at: new Date().toISOString(), ...camposExtras })
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId);

  if (error) {
    console.error("[dono-conversa] assumir_failed", JSON.stringify({ conversaId, dono, code: error.code ?? null }));
    return { ok: false, error: "update_failed" };
  }
  return { ok: true };
}

/** Solta a conversa de volta pro humano (nenhum automatismo responde até algo assumir de novo). */
export async function liberarControle(
  clinicaId: string,
  conversaId: string,
  camposExtras: Record<string, unknown> = {}
): Promise<{ ok: boolean; error?: string }> {
  return assumirControle(clinicaId, conversaId, "humano", camposExtras);
}
