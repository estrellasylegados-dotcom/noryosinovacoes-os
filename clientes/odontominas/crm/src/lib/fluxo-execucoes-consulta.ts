import { getSupabaseServerClient } from "@/lib/supabase";
import type { EstadoExecucao } from "@/lib/fluxo-motor";

/**
 * Leituras de `fluxo_execucoes`/`fluxo_execucao_eventos` pro editor visual
 * (Fase 2b/3): timeline do modo teste (polling) e histórico de execuções ao
 * reabrir o editor. Sem teste direto, mesmo critério de `fluxo-execucoes.ts`
 * — é camada de I/O fina, a lógica de negócio já foi testada na lib que
 * escreve essas tabelas.
 */

export type ExecucaoFluxoResumo = {
  id: string;
  fluxoId: string;
  estado: EstadoExecucao;
  noAtualId: string | null;
  isTest: boolean;
  gatilhoTipo: string;
  motivoFinalizacao: string | null;
  erro: string | null;
  createdAt: string;
  finalizadoEm: string | null;
};

type LinhaExecucao = {
  id: string;
  fluxo_id: string;
  estado: string;
  no_atual_id: string | null;
  is_test: boolean;
  gatilho_tipo: string;
  motivo_finalizacao: string | null;
  erro: string | null;
  created_at: string;
  finalizado_em: string | null;
};

function mapExecucao(row: LinhaExecucao): ExecucaoFluxoResumo {
  return {
    id: row.id,
    fluxoId: row.fluxo_id,
    estado: row.estado as EstadoExecucao,
    noAtualId: row.no_atual_id,
    isTest: row.is_test,
    gatilhoTipo: row.gatilho_tipo,
    motivoFinalizacao: row.motivo_finalizacao,
    erro: row.erro,
    createdAt: row.created_at,
    finalizadoEm: row.finalizado_em,
  };
}

const EXECUCAO_COLUNAS = "id, fluxo_id, estado, no_atual_id, is_test, gatilho_tipo, motivo_finalizacao, erro, created_at, finalizado_em";

export type FiltroListaExecucoes = { isTest?: boolean; limit?: number };

export async function listarExecucoesFluxo(
  clinicaId: string,
  fluxoId: string,
  filtro?: FiltroListaExecucoes
): Promise<ExecucaoFluxoResumo[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase.from("fluxo_execucoes").select(EXECUCAO_COLUNAS).eq("clinica_id", clinicaId).eq("fluxo_id", fluxoId);
  if (filtro?.isTest !== undefined) query = query.eq("is_test", filtro.isTest);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(filtro?.limit ?? 20);
  if (error || !data) return [];
  return (data as LinhaExecucao[]).map(mapExecucao);
}

export async function buscarExecucao(clinicaId: string, execucaoId: string): Promise<ExecucaoFluxoResumo | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("fluxo_execucoes")
    .select(EXECUCAO_COLUNAS)
    .eq("id", execucaoId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();

  if (error || !data) return null;
  return mapExecucao(data as LinhaExecucao);
}

export type EventoExecucao = {
  id: string;
  sequencia: number;
  noId: string;
  tipoEvento: string;
  tentativa: number;
  status: "em_andamento" | "concluido" | "falhou";
  erro: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listarEventosExecucao(clinicaId: string, execucaoId: string): Promise<EventoExecucao[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("fluxo_execucao_eventos")
    .select("id, sequencia, no_id, tipo_evento, tentativa, status, erro, created_at, updated_at")
    .eq("clinica_id", clinicaId)
    .eq("execucao_id", execucaoId)
    .order("sequencia", { ascending: true });

  if (error || !data) return [];
  return data.map((e) => ({
    id: e.id as string,
    sequencia: e.sequencia as number,
    noId: e.no_id as string,
    tipoEvento: e.tipo_evento as string,
    tentativa: e.tentativa as number,
    status: e.status as EventoExecucao["status"],
    erro: e.erro as string | null,
    createdAt: e.created_at as string,
    updatedAt: e.updated_at as string,
  }));
}
