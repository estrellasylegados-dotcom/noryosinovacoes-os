import { getSupabaseServerClient } from "@/lib/supabase";
import type { ControleOdontoEntityType } from "./types";

const PROVIDER = "controle_odonto";

export interface ExternalIdRow {
  id: string;
  entityType: ControleOdontoEntityType;
  entityId: string | null;
  externalId: string;
  metadata: Record<string, unknown>;
  needsReview: boolean;
}

/**
 * Upsert idempotente: a mesma (clínica, tipo, id externo) nunca cria linha
 * duplicada — é a chave de dedupe pedida na seção IDEMPOTÊNCIA. O mesmo
 * agendamento chegando 20x pelo polling atualiza a mesma linha 20x, nunca
 * cria 20.
 */
export async function upsertExternalId(
  clinicaId: string,
  entityType: ControleOdontoEntityType,
  externalId: string,
  patch: { entityId?: string | null; metadata?: Record<string, unknown>; needsReview?: boolean } = {}
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { error } = await supabase.from("external_ids").upsert(
    {
      clinica_id: clinicaId,
      provider: PROVIDER,
      entity_type: entityType,
      external_id: externalId,
      entity_id: patch.entityId ?? null,
      metadata: patch.metadata ?? {},
      needs_review: patch.needsReview ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinica_id,provider,entity_type,external_id" }
  );

  if (error) {
    console.error("[controle-odonto/external-ids] upsert_failed", JSON.stringify({ entityType, code: error.code ?? null }));
    return { ok: false, error: "upsert_failed" };
  }

  return { ok: true };
}

export async function buscarExternalId(
  clinicaId: string,
  entityType: ControleOdontoEntityType,
  externalId: string
): Promise<ExternalIdRow | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("external_ids")
    .select("id, entity_type, entity_id, external_id, metadata, needs_review")
    .eq("clinica_id", clinicaId)
    .eq("provider", PROVIDER)
    .eq("entity_type", entityType)
    .eq("external_id", externalId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    entityType: data.entity_type as ControleOdontoEntityType,
    entityId: (data.entity_id as string | null) ?? null,
    externalId: data.external_id as string,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
    needsReview: Boolean(data.needs_review),
  };
}
