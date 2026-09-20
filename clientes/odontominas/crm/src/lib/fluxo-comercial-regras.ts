/** Regras comerciais do motor de Fluxos. Puras; nenhum worker ou interpretador novo. */
export const GATILHO_KANBAN = "kanban_stage_changed";
export const MODOS_KANBAN = ["entrada", "saida", "permanencia", "convertida", "perdida"] as const;
export type ModoKanban = (typeof MODOS_KANBAN)[number];
export type ConfigComercial = {
  pipelineId: string;
  etapaId: string;
  modo: ModoKanban;
  tempoSegundos: number;
  reentrada: "por_entrada" | "uma_vez" | "sempre";
  pararAoSair: boolean;
  pararAoResponder: boolean;
  respeitarHorario: boolean;
  aceitarOrigemAutomacao: boolean;
};
export type EventoKanban = {
  id: string; clinica_id: string; oportunidade_id: string; paciente_id: string;
  pipeline_id: string; stage_from: string | null; stage_to: string;
  status: "open" | "won" | "lost"; occurred_at: string; entrada_em: string;
  conversa_id: string | null; responsavel_id: string | null;
  origem: string; cadeia: string[];
};
export function lerConfigComercial(bruto: unknown): ConfigComercial | null {
  if (!bruto || typeof bruto !== "object") return null;
  const c = bruto as Record<string, unknown>;
  if (typeof c.pipelineId !== "string" || !c.pipelineId || !MODOS_KANBAN.includes(c.modo as ModoKanban)) return null;
  if (!["convertida", "perdida"].includes(String(c.modo)) && (typeof c.etapaId !== "string" || !c.etapaId)) return null;
  const tempo = c.tempoSegundos ?? 0;
  if (typeof tempo !== "number" || !Number.isFinite(tempo) || tempo < 0 || tempo > 366 * 86400) return null;
  if (c.modo === "permanencia" && tempo < 1) return null;
  if (c.reentrada !== undefined && !["por_entrada", "uma_vez", "sempre"].includes(String(c.reentrada))) return null;
  for (const k of ["pararAoSair", "pararAoResponder", "respeitarHorario", "aceitarOrigemAutomacao"]) {
    if (c[k] !== undefined && typeof c[k] !== "boolean") return null;
  }
  return {
    pipelineId: c.pipelineId, etapaId: typeof c.etapaId === "string" ? c.etapaId : "",
    modo: c.modo as ModoKanban, tempoSegundos: tempo,
    reentrada: (c.reentrada ?? "por_entrada") as ConfigComercial["reentrada"],
    pararAoSair: c.pararAoSair !== false, pararAoResponder: c.pararAoResponder !== false,
    respeitarHorario: c.respeitarHorario !== false, aceitarOrigemAutomacao: c.aceitarOrigemAutomacao === true,
  };
}
export function combinaEventoComercial(c: ConfigComercial, e: EventoKanban, fluxoId: string): boolean {
  if (e.pipeline_id !== c.pipelineId || e.stage_from === e.stage_to) return false;
  // Uma cadeia persiste através de esperas, novas execuções e republicações.
  if (e.cadeia.length >= 10 || e.cadeia.includes(fluxoId)) return false;
  if (e.origem === "automacao" && !c.aceitarOrigemAutomacao) return false;
  switch (c.modo) {
    case "entrada": case "permanencia": return e.stage_to === c.etapaId;
    case "saida": return e.stage_from === c.etapaId;
    case "convertida": return e.status === "won";
    case "perdida": return e.status === "lost";
  }
}
export function chaveComercial(c: ConfigComercial, e: EventoKanban): string {
  // A versão NÃO torna uma ocorrência antiga nova depois de republicar.
  return c.reentrada === "uma_vez" ? `oportunidade:${e.oportunidade_id}` : `kanban:${e.oportunidade_id}:${e.id}`;
}
export function agendamentoComercial(c: ConfigComercial, e: EventoKanban): string {
  return new Date(Date.parse(e.entrada_em) + (c.modo === "permanencia" ? c.tempoSegundos * 1000 : 0)).toISOString();
}
export const CAMPOS_COMERCIAIS = [
  ["oportunidade_etapa_id", "Etapa atual"], ["oportunidade_pipeline_id", "Pipeline"],
  ["oportunidade_aberta", "Oportunidade aberta"], ["responsavel_id", "Responsável"],
  ["etiquetas", "Etiquetas da conversa"], ["origem_lead", "Origem do contato"],
  ["canal_id", "Canal"], ["paciente_respondeu", "Paciente respondeu nesta sequência"],
  ["ultima_interacao_em", "Última interação"], ["tentativas", "Mensagens enviadas nesta sequência"],
  ["sla", "Situação do SLA"], ["motivo_perda_id", "Motivo da perda"],
  ["tempo_etapa_segundos", "Tempo na etapa (segundos)"],
] as const;
export function mensagemMotivoComercial(motivo: string | null): string {
  const rotulos: Record<string, string> = {
    etapa_alterada: "A oportunidade mudou de etapa.", oportunidade_encerrada: "O ciclo comercial foi encerrado.",
    paciente_respondeu: "O paciente respondeu.", intervencao_humana: "O atendimento foi assumido por uma pessoa.",
    interrompida_manualmente: "Interrompida por uma pessoa autorizada.", envio_incerto: "A entrega precisa de conferência na conversa.",
    opt_out: "O paciente pediu para não receber mensagens.", contexto_invalido: "Os dados necessários não estão disponíveis.",
  };
  return motivo ? rotulos[motivo] ?? "A automação foi encerrada. Consulte a equipe responsável." : "";
}
