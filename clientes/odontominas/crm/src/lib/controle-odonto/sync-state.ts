import { getSupabaseServerClient } from "@/lib/supabase";
import { VERSAO_CONECTOR_CONTROLE_ODONTO } from "./config";
import type { IntegrationHealth } from "./types";

const PROVIDER = "controle_odonto";
const LIMITE_FALHAS_INDISPONIVEL = 3;

export interface SyncState {
  lastSuccessAt: string | null;
  lastCursor: string | null;
  lastWindowStart: string | null;
  lastWindowEnd: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  consecutiveFailures: number;
  health: IntegrationHealth;
  lastDurationMs: number | null;
  lastRunCount: number | null;
  connectorVersion: string | null;
}

/**
 * Pura e testável sem Supabase — baseada em sucesso/falhas seguidas, como
 * pedido na seção SAÚDE DA INTEGRAÇÃO (último sucesso, falhas consecutivas,
 * último erro). `enabled=false` sempre vence: integração desligada nunca é
 * "saudável".
 */
export function calcularHealth(params: {
  enabled: boolean;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
}): IntegrationHealth {
  if (!params.enabled) return "nao_configurada";
  if (params.consecutiveFailures >= LIMITE_FALHAS_INDISPONIVEL) return "indisponivel";
  if (params.consecutiveFailures > 0) return "degradada";
  return params.lastSuccessAt ? "saudavel" : "nao_configurada";
}

export async function getSyncState(clinicaId: string, resource: string): Promise<SyncState | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("integration_sync_state")
    .select(
      "last_success_at, last_cursor, last_window_start, last_window_end, last_error_at, last_error_code, consecutive_failures, health, last_duration_ms, last_run_count, connector_version"
    )
    .eq("clinica_id", clinicaId)
    .eq("provider", PROVIDER)
    .eq("resource", resource)
    .maybeSingle();

  if (error || !data) return null;

  return {
    lastSuccessAt: data.last_success_at as string | null,
    lastCursor: data.last_cursor as string | null,
    lastWindowStart: data.last_window_start as string | null,
    lastWindowEnd: data.last_window_end as string | null,
    lastErrorAt: data.last_error_at as string | null,
    lastErrorCode: data.last_error_code as string | null,
    consecutiveFailures: (data.consecutive_failures as number | null) ?? 0,
    health: (data.health as IntegrationHealth | null) ?? "nao_configurada",
    lastDurationMs: data.last_duration_ms as number | null,
    lastRunCount: data.last_run_count as number | null,
    connectorVersion: data.connector_version as string | null,
  };
}

export async function registrarSucessoSync(
  clinicaId: string,
  resource: string,
  patch: { janelaInicio: Date; janelaFim: Date; duracaoMs: number; quantidade: number }
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const agora = new Date().toISOString();

  const { error } = await supabase.from("integration_sync_state").upsert(
    {
      clinica_id: clinicaId,
      provider: PROVIDER,
      resource,
      last_success_at: agora,
      last_window_start: patch.janelaInicio.toISOString(),
      last_window_end: patch.janelaFim.toISOString(),
      last_duration_ms: patch.duracaoMs,
      last_run_count: patch.quantidade,
      consecutive_failures: 0,
      last_error_at: null,
      last_error_code: null,
      health: "saudavel" satisfies IntegrationHealth,
      connector_version: VERSAO_CONECTOR_CONTROLE_ODONTO,
      updated_at: agora,
    },
    { onConflict: "clinica_id,provider,resource" }
  );

  if (error) console.error("[controle-odonto/sync-state] registrar_sucesso_failed", JSON.stringify({ resource, code: error.code ?? null }));
}

export async function registrarFalhaSync(clinicaId: string, resource: string, errorCode: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const atual = await getSyncState(clinicaId, resource);
  const falhas = (atual?.consecutiveFailures ?? 0) + 1;
  const agora = new Date().toISOString();

  const { error } = await supabase.from("integration_sync_state").upsert(
    {
      clinica_id: clinicaId,
      provider: PROVIDER,
      resource,
      consecutive_failures: falhas,
      last_error_at: agora,
      last_error_code: errorCode,
      health: calcularHealth({ enabled: true, consecutiveFailures: falhas, lastSuccessAt: atual?.lastSuccessAt ?? null }),
      connector_version: VERSAO_CONECTOR_CONTROLE_ODONTO,
      updated_at: agora,
    },
    { onConflict: "clinica_id,provider,resource" }
  );

  if (error) console.error("[controle-odonto/sync-state] registrar_falha_failed", JSON.stringify({ resource, code: error.code ?? null }));
}
