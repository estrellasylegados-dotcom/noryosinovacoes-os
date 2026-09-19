import type { AtorConversa } from "@/lib/atribuicao";
import type { StatusSlaConversa } from "@/lib/sla";

/**
 * Regras PURAS do Kanban comercial (sem I/O, testadas em kanban-regras.test.ts).
 * Persistência e concorrência ficam nas funções Postgres da migration v33
 * (mover_oportunidade etc.); aqui só o que dá pra decidir sem banco:
 * visibilidade por perfil, filtros, mapeamento de SLA, erros -> HTTP.
 *
 * Princípio: ESTÁGIO (kanban) != TAG (etiquetas) != STATUS da conversa.
 * Nada aqui lê/escreve tag nem status de conversa pra decidir estágio.
 */

export type TipoEstagio = "open" | "won" | "lost";
export type StatusOportunidade = TipoEstagio;
export type OrigemMudanca = "manual" | "automacao" | "api" | "controle_odonto" | "sistema";
export type SlaKanban = "ok" | "warning" | "breached" | "paused" | "not_configured";

// ---------------------------------------------------------------------------
// Visibilidade / permissão de mover (backend é a autoridade)
// ---------------------------------------------------------------------------

/**
 * Espelha a regra do Chat: quem tem `conversas.visualizar_todas` vê todos os
 * cards; os demais veem os próprios + os sem responsável (senão nunca
 * enxergariam o que assumir). `kanban.visualizar` é pré-requisito.
 */
export function podeVerCard(ator: Pick<AtorConversa, "atendenteId" | "permissoes">, responsavelId: string | null): boolean {
  if (!ator.permissoes.has("kanban.visualizar")) return false;
  if (ator.permissoes.has("conversas.visualizar_todas")) return true;
  return responsavelId === null || responsavelId === ator.atendenteId;
}

/** Mover exige `kanban.mover` E poder ver o card (atendente não move card de outra pessoa). */
export function podeMoverCard(ator: Pick<AtorConversa, "atendenteId" | "permissoes">, responsavelId: string | null): boolean {
  return ator.permissoes.has("kanban.mover") && podeVerCard(ator, responsavelId);
}

export function veTodosOsCards(ator: Pick<AtorConversa, "permissoes">): boolean {
  return ator.permissoes.has("conversas.visualizar_todas");
}

// ---------------------------------------------------------------------------
// Resposta das funções Postgres -> erro de domínio -> HTTP
// ---------------------------------------------------------------------------

export type ErroKanban =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflito"
  | "estagio_invalido"
  | "motivo_obrigatorio"
  | "ja_existe_aberta"
  | "responsavel_invalido"
  | "paciente_nao_encontrado"
  | "backend_unavailable"
  | "invalid_body"
  | "rpc_failed";

export function statusHttpKanban(error: string | undefined): number {
  switch (error) {
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
    case "paciente_nao_encontrado":
      return 404;
    case "conflito":
    case "ja_existe_aberta":
      return 409;
    case "estagio_invalido":
    case "motivo_obrigatorio":
    case "responsavel_invalido":
    case "invalid_body":
      return 400;
    default:
      return 503;
  }
}

// ---------------------------------------------------------------------------
// SLA: só traduz o que o serviço de SLA já calculou (nunca recalcula)
// ---------------------------------------------------------------------------

/** `null` = conversa sem ciclo de SLA aberto (nada a mostrar no card). */
export function slaParaKanban(status: StatusSlaConversa | undefined): SlaKanban | null {
  if (!status) return null;
  if (status.tipo === "sem_ciclo") return null;
  return status.tipo;
}

// ---------------------------------------------------------------------------
// Filtros do board
// ---------------------------------------------------------------------------

export type CardKanban = {
  id: string;
  pacienteId: string;
  pacienteNome: string | null;
  telefone: string | null;
  interesse: string | null;
  estagioId: string;
  status: StatusOportunidade;
  versao: number;
  responsavelId: string | null;
  responsavelNome: string | null;
  conversaId: string | null;
  canalId: string | null;
  canalNome: string | null;
  origem: string | null;
  campanhaId: string | null;
  etiquetas: { id: string; nome: string; cor: string }[];
  sla: SlaKanban | null;
  statusConversa: string | null;
  naoLidas: number;
  ultimaInteracaoEm: string | null;
  estagioEntrouEm: string;
  criadoEm: string;
  motivoPerda: string | null;
};

export type FiltrosKanban = {
  busca?: string;
  responsavelId?: string; // "sem" = sem responsável
  canalId?: string;
  etiquetaIds?: string[];
  origem?: string;
  interesse?: string;
  sla?: SlaKanban;
  de?: string; // ISO — criado_em >=
  ate?: string; // ISO — criado_em <=
  estagioId?: string;
};

function normalizar(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function soDigitos(t: string): string {
  return t.replace(/\D/g, "");
}

/** Busca por nome, telefone (só dígitos) e interesse. */
export function combinaBusca(card: Pick<CardKanban, "pacienteNome" | "telefone" | "interesse">, termo: string): boolean {
  const t = normalizar(termo);
  if (!t) return true;
  if (normalizar(card.pacienteNome ?? "").includes(t)) return true;
  if (normalizar(card.interesse ?? "").includes(t)) return true;
  const digitos = soDigitos(termo);
  return digitos.length >= 3 && soDigitos(card.telefone ?? "").includes(digitos);
}

export function filtrarCards(cards: CardKanban[], f: FiltrosKanban): CardKanban[] {
  return cards.filter((c) => {
    if (f.busca && !combinaBusca(c, f.busca)) return false;
    if (f.estagioId && c.estagioId !== f.estagioId) return false;
    if (f.responsavelId) {
      if (f.responsavelId === "sem" ? c.responsavelId !== null : c.responsavelId !== f.responsavelId) return false;
    }
    if (f.canalId && c.canalId !== f.canalId) return false;
    if (f.etiquetaIds && f.etiquetaIds.length > 0 && !f.etiquetaIds.every((id) => c.etiquetas.some((e) => e.id === id))) return false;
    if (f.origem && normalizar(c.origem ?? "") !== normalizar(f.origem)) return false;
    if (f.interesse && !normalizar(c.interesse ?? "").includes(normalizar(f.interesse))) return false;
    if (f.sla && c.sla !== f.sla) return false;
    if (f.de && new Date(c.criadoEm).getTime() < new Date(f.de).getTime()) return false;
    if (f.ate && new Date(c.criadoEm).getTime() > new Date(f.ate).getTime()) return false;
    return true;
  });
}

/** Tempo no estágio em ms, derivado de `estagio_entrou_em` (base de "há 3 dias em Follow-up" e de cards parados no futuro). */
export function tempoNoEstagioMs(estagioEntrouEm: string, agora: Date): number {
  return Math.max(0, agora.getTime() - new Date(estagioEntrouEm).getTime());
}

// ---------------------------------------------------------------------------
// Evento interno (payload fixo, consumido pelo motor de automação)
// ---------------------------------------------------------------------------

export const EVENTO_KANBAN_ESTAGIO = "kanban_stage_changed";

export type PayloadEstagioAlterado = {
  clinica_id: string;
  oportunidade_id: string;
  paciente_id: string;
  pipeline_id: string;
  stage_from: string | null;
  stage_to: string;
  actor_id: string | null;
  occurred_at: string;
  origem: OrigemMudanca;
};

export function montarPayloadEstagioAlterado(p: {
  clinicaId: string;
  oportunidadeId: string;
  pacienteId: string;
  pipelineId: string;
  estagioDe: string | null;
  estagioPara: string;
  atorId: string | null;
  ocorreuEm: Date;
  origem: OrigemMudanca;
}): PayloadEstagioAlterado {
  return {
    clinica_id: p.clinicaId,
    oportunidade_id: p.oportunidadeId,
    paciente_id: p.pacienteId,
    pipeline_id: p.pipelineId,
    stage_from: p.estagioDe,
    stage_to: p.estagioPara,
    actor_id: p.atorId,
    occurred_at: p.ocorreuEm.toISOString(),
    origem: p.origem,
  };
}

/** Evento de auditoria (segurança/quem fez) — o histórico de NEGÓCIO fica em oportunidade_historico. */
export function eventoAuditoriaMovimento(tipoDestino: TipoEstagio): "OPPORTUNITY_STAGE_CHANGED" | "OPPORTUNITY_WON" | "OPPORTUNITY_LOST" {
  if (tipoDestino === "won") return "OPPORTUNITY_WON";
  if (tipoDestino === "lost") return "OPPORTUNITY_LOST";
  return "OPPORTUNITY_STAGE_CHANGED";
}
