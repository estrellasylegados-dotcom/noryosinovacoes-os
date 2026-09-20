import { registrarEvento } from "@/lib/auditoria";
import { resolverPorEvento } from "@/lib/alertas";
import { sincronizarResponsavelDaConversa } from "@/lib/kanban";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { Perfil } from "@/lib/permissoes";

export type DistribuicaoConfig = {
  ativa: boolean;
  estrategia: "round_robin";
};

export type SalvarDistribuicaoInput = {
  ativa?: unknown;
  estrategia?: unknown;
};

export type ResultadoDistribuicao =
  | { ok: true; assigned: true; atendenteId: string }
  | { ok: true; assigned: false; reason: "disabled" | "already_assigned" | "no_eligible" | "concurrent_assignment" }
  | { ok: false; error: "backend_unavailable" | "not_found" | "rpc_failed" };

type RespostaRpc = {
  ok?: boolean;
  assigned?: boolean;
  reason?: ResultadoDistribuicao extends { reason: infer R } ? R : string;
  error?: string;
  atendente_id?: string | null;
};

const DEFAULT_CONFIG: DistribuicaoConfig = { ativa: false, estrategia: "round_robin" };

export async function buscarConfigDistribuicao(clinicaId: string): Promise<DistribuicaoConfig> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return DEFAULT_CONFIG;

  const { data } = await supabase
    .from("atendimento_config")
    .select("auto_distribuicao_ativa, auto_distribuicao_estrategia")
    .eq("clinica_id", clinicaId)
    .maybeSingle();

  return {
    ativa: (data?.auto_distribuicao_ativa as boolean | null) ?? false,
    estrategia: "round_robin",
  };
}

export async function salvarConfigDistribuicao(
  clinicaId: string,
  input: SalvarDistribuicaoInput,
  ator: { atendenteId: string; perfil: Perfil }
): Promise<{ ok: true; config: DistribuicaoConfig } | { ok: false; error: "invalid_body" | "estrategia_invalida" | "backend_unavailable" | "persist_failed" }> {
  if (input.ativa !== undefined && typeof input.ativa !== "boolean") return { ok: false, error: "invalid_body" };
  if (input.estrategia !== undefined && input.estrategia !== "round_robin") return { ok: false, error: "estrategia_invalida" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const anterior = await buscarConfigDistribuicao(clinicaId);
  const proxima: DistribuicaoConfig = {
    ativa: typeof input.ativa === "boolean" ? input.ativa : anterior.ativa,
    estrategia: "round_robin",
  };

  const { error } = await supabase.from("atendimento_config").upsert(
    {
      clinica_id: clinicaId,
      auto_distribuicao_ativa: proxima.ativa,
      auto_distribuicao_estrategia: proxima.estrategia,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinica_id" }
  );
  if (error) return { ok: false, error: "persist_failed" };

  if (anterior.ativa !== proxima.ativa) {
    await registrarEvento({
      clinicaId,
      atorId: ator.atendenteId,
      atorPerfil: ator.perfil,
      evento: proxima.ativa ? "AUTO_DISTRIBUTION_ENABLED" : "AUTO_DISTRIBUTION_DISABLED",
      alvoId: clinicaId,
      detalhes: { estrategia: proxima.estrategia },
    });
  }

  return { ok: true, config: proxima };
}

export async function distribuirConversaSeElegivel(clinicaId: string, conversaId: string): Promise<ResultadoDistribuicao> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data, error } = await supabase.rpc("auto_distribuir_conversa_round_robin", { p_clinica: clinicaId, p_conversa: conversaId });
  if (error || !data) return { ok: false, error: "rpc_failed" };

  const r = data as RespostaRpc;
  if (r.ok !== true) return { ok: false, error: r.error === "not_found" ? "not_found" : "rpc_failed" };
  if (r.assigned === true && r.atendente_id) {
    await sincronizarResponsavelDaConversa(clinicaId, conversaId, null, r.atendente_id, null);
    await resolverPorEvento(clinicaId, {
      tipos: ["conversa_sem_responsavel"],
      tipoEntidade: "conversa",
      entidadeId: conversaId,
      evento: "distribuicao_automatica",
      atorId: null,
    });
    return { ok: true, assigned: true, atendenteId: r.atendente_id };
  }

  const reason = r.reason === "already_assigned" || r.reason === "no_eligible" || r.reason === "concurrent_assignment" ? r.reason : "disabled";
  return { ok: true, assigned: false, reason };
}
