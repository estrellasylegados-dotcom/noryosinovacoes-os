import { getSupabaseServerClient } from "@/lib/supabase";

const PROVIDER = "controle_odonto";

export type OperacaoSyncLog = "leitura" | "criacao" | "atualizacao" | "cancelamento";
export type DirecaoSyncLog = "entrada" | "saida";
export type StatusSyncLog = "sucesso" | "erro" | "ignorado";

export interface RegistroSyncLog {
  clinicaId: string;
  resource: string;
  operation: OperacaoSyncLog;
  direction: DirecaoSyncLog;
  externalId?: string | null;
  localId?: string | null;
  status: StatusSyncLog;
  attempt?: number;
  httpStatus?: number | null;
  durationMs?: number | null;
  errorCode?: string | null;
  errorMessageSanitized?: string | null;
  startedAt: Date;
  finishedAt?: Date | null;
}

/** Nunca recebe senha/token/authorization header/payload clínico completo — só o que a tabela aceita (ver migration v15). */
export async function registrarLog(registro: RegistroSyncLog): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { error } = await supabase.from("integration_sync_log").insert({
    clinica_id: registro.clinicaId,
    provider: PROVIDER,
    resource: registro.resource,
    operation: registro.operation,
    direction: registro.direction,
    external_id: registro.externalId ?? null,
    local_id: registro.localId ?? null,
    status: registro.status,
    attempt: registro.attempt ?? 1,
    http_status: registro.httpStatus ?? null,
    duration_ms: registro.durationMs ?? null,
    error_code: registro.errorCode ?? null,
    error_message_sanitized: registro.errorMessageSanitized?.slice(0, 500) ?? null,
    started_at: registro.startedAt.toISOString(),
    finished_at: registro.finishedAt?.toISOString() ?? null,
  });

  if (error) console.error("[controle-odonto/sync-log] insert_failed", JSON.stringify({ code: error.code ?? null }));
}

export interface FiltrosSyncLog {
  status?: "sucesso" | "erro";
  resource?: string;
  direction?: DirecaoSyncLog;
  limite?: number;
}

export async function listarLogs(clinicaId: string, filtros: FiltrosSyncLog = {}): Promise<Array<Record<string, unknown>>> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("integration_sync_log")
    .select(
      "id, resource, operation, direction, status, attempt, http_status, duration_ms, error_code, error_message_sanitized, started_at, finished_at"
    )
    .eq("clinica_id", clinicaId)
    .eq("provider", PROVIDER)
    .order("started_at", { ascending: false })
    .limit(filtros.limite ?? 100);

  if (filtros.status) query = query.eq("status", filtros.status);
  if (filtros.resource) query = query.eq("resource", filtros.resource);
  if (filtros.direction) query = query.eq("direction", filtros.direction);

  const { data, error } = await query;
  if (error || !data) return [];
  return data;
}
