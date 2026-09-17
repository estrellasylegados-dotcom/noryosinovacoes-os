import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Log estruturado dos 5 marcos do funil de uma Campanha (item 15/29 do
 * briefing) — não um evento por mensagem trocada (isso já dá pra contar
 * direto em `conversas`/`mensagens`, ver src/lib/campanha-metricas.ts). A
 * unique key (campanha_id, paciente_id, tipo) na migração v19 é a
 * idempotência: `registrarEventoCampanha` nunca duplica o mesmo marco pro
 * mesmo paciente, mesmo padrão de dedup atômico já usado no Pixel
 * (src/lib/agentes-pixel.ts).
 *
 * `appointment_attended`/`treatment_closed` nascem só de registro manual
 * (painel) — sem ControleODONTO real ainda (credencial pendente, ver
 * `docs/integrations/controle-odonto.md`). `valor` só existe quando alguém
 * registra de verdade: nunca inventar receita.
 */

export type TipoEventoCampanha = "new_lead" | "qualified_lead" | "appointment_booked" | "appointment_attended" | "treatment_closed";

export type EventoCampanha = {
  id: string;
  campanhaId: string;
  pacienteId: string | null;
  conversaId: string | null;
  tipo: TipoEventoCampanha;
  valor: number | null;
  metadata: Record<string, unknown>;
  registradoPor: string | null;
  createdAt: string;
};

export type DadosEventoCampanha = {
  pacienteId?: string | null;
  conversaId?: string | null;
  valor?: number | null;
  metadata?: Record<string, unknown>;
  registradoPor?: string | null;
};

export type ResultadoEventoCampanha = { ok: boolean; novo: boolean; error?: string };

/** Insere o marco se ainda não existir pra esse (campanha, paciente, tipo) — idempotente por design (unique key no banco). */
export async function registrarEventoCampanha(
  clinicaId: string,
  campanhaId: string,
  tipo: TipoEventoCampanha,
  dados: DadosEventoCampanha = {}
): Promise<ResultadoEventoCampanha> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, novo: false, error: "backend_unavailable" };

  const { error } = await supabase.from("campanha_eventos").insert({
    clinica_id: clinicaId,
    campanha_id: campanhaId,
    paciente_id: dados.pacienteId ?? null,
    conversa_id: dados.conversaId ?? null,
    tipo,
    valor: dados.valor ?? null,
    metadata: dados.metadata ?? {},
    registrado_por: dados.registradoPor ?? null,
  });

  if (error) {
    // 23505 = unique_violation: o marco já existia pra esse paciente — sucesso idempotente, não é falha.
    if (error.code === "23505") return { ok: true, novo: false };
    console.error("[campanha-eventos] registrar_failed", JSON.stringify({ campanhaId, tipo, code: error.code ?? null }));
    return { ok: false, novo: false, error: "persist_failed" };
  }

  return { ok: true, novo: true };
}

export async function listarEventosCampanha(clinicaId: string, campanhaId: string): Promise<EventoCampanha[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("campanha_eventos")
    .select("id, campanha_id, paciente_id, conversa_id, tipo, valor, metadata, registrado_por, created_at")
    .eq("clinica_id", clinicaId)
    .eq("campanha_id", campanhaId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((e) => ({
    id: e.id as string,
    campanhaId: e.campanha_id as string,
    pacienteId: (e.paciente_id as string | null) ?? null,
    conversaId: (e.conversa_id as string | null) ?? null,
    tipo: e.tipo as TipoEventoCampanha,
    valor: (e.valor as number | null) ?? null,
    metadata: (e.metadata as Record<string, unknown>) ?? {},
    registradoPor: (e.registrado_por as string | null) ?? null,
    createdAt: e.created_at as string,
  }));
}
