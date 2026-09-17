import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Campanhas — módulo estratégico (Ferramentas → Campanhas, 2026-09-16).
 * Uma Campanha é a iniciativa de marketing/comercial (objetivo, público,
 * canais, metas, receita); um Disparo (src/lib/disparos.ts) é a execução
 * operacional de mensagem — uma campanha pode agrupar vários disparos por
 * `disparos.campanha_id`, mas nunca reimplementa o envio. Motor de público
 * é sempre `src/lib/audiencias.ts` (por `audiencia_id`) — Campanhas nunca
 * reconstrói segmentação própria.
 *
 * `objetivo`/`tipo`/`especialidade` são texto livre no banco (sem CHECK) —
 * os catálogos abaixo só alimentam o <select> do formulário; escolher
 * "outro" libera texto digitado, e uma opção nova não pedida aqui ainda
 * funciona (rótulo cai pro próprio valor cru, mesmo padrão de
 * `labelStatus` em src/lib/status.ts).
 */

export type StatusCampanha = "rascunho" | "agendada" | "ativa" | "pausada" | "concluida" | "cancelada";

export const STATUS_CAMPANHA_ORDEM: StatusCampanha[] = ["rascunho", "agendada", "ativa", "pausada", "concluida", "cancelada"];

export const LABEL_STATUS_CAMPANHA: Record<StatusCampanha, string> = {
  rascunho: "Rascunho",
  agendada: "Agendada",
  ativa: "Ativa",
  pausada: "Pausada",
  concluida: "Encerrada",
  cancelada: "Cancelada",
};

export function isStatusCampanhaValido(valor: string): valor is StatusCampanha {
  return (STATUS_CAMPANHA_ORDEM as string[]).includes(valor);
}

export type OpcaoCatalogo = { valor: string; label: string };

export const OBJETIVOS_CAMPANHA: OpcaoCatalogo[] = [
  { valor: "gerar_agendamentos", label: "Gerar agendamentos" },
  { valor: "captar_pacientes", label: "Captar novos pacientes" },
  { valor: "reativar_pacientes", label: "Reativar pacientes" },
  { valor: "recuperar_orcamento", label: "Recuperar orçamento" },
  { valor: "converter_avaliacao", label: "Converter avaliação em tratamento" },
  { valor: "gerar_retorno", label: "Gerar retorno" },
  { valor: "recuperar_faltas", label: "Recuperar faltas" },
  { valor: "gerar_indicacao", label: "Gerar indicação" },
  { valor: "informativa", label: "Campanha informativa" },
  { valor: "pos_atendimento", label: "Pós-atendimento" },
  { valor: "outro", label: "Outro" },
];

export const TIPOS_CAMPANHA: OpcaoCatalogo[] = [
  { valor: "implantes", label: "Implantes" },
  { valor: "ortodontia", label: "Ortodontia" },
  { valor: "clareamento", label: "Clareamento" },
  { valor: "limpeza_prevencao", label: "Limpeza/Prevenção" },
  { valor: "reativacao", label: "Reativação" },
  { valor: "recuperacao_orcamento", label: "Recuperação de orçamento" },
  { valor: "retorno", label: "Retorno" },
  { valor: "indicacao", label: "Indicação" },
  { valor: "sazonal", label: "Sazonal" },
  { valor: "institucional", label: "Institucional" },
  { valor: "outro", label: "Outro" },
];

export const CANAIS_CAMPANHA: OpcaoCatalogo[] = [
  { valor: "whatsapp", label: "WhatsApp" },
  { valor: "meta_ads", label: "Meta Ads" },
  { valor: "google_ads", label: "Google Ads" },
  { valor: "site", label: "Site/Landing Page" },
  { valor: "organico", label: "Orgânico" },
  { valor: "indicacao", label: "Indicação" },
  { valor: "ligacao", label: "Ligação" },
  { valor: "email", label: "E-mail" },
  { valor: "outro", label: "Outro" },
];

export function labelObjetivo(valor: string): string {
  return OBJETIVOS_CAMPANHA.find((o) => o.valor === valor)?.label ?? valor;
}
export function labelTipoCampanha(valor: string): string {
  return TIPOS_CAMPANHA.find((t) => t.valor === valor)?.label ?? valor;
}
export function labelCanal(valor: string): string {
  return CANAIS_CAMPANHA.find((c) => c.valor === valor)?.label ?? valor;
}

export type MetasCampanha = {
  leads?: number;
  respostas?: number;
  agendamentos?: number;
  comparecimentos?: number;
  fechamentos?: number;
  receita?: number;
  cpa?: number;
  cpl?: number;
  roas?: number;
};

export type Campanha = {
  id: string;
  nome: string;
  descricao: string | null;
  responsavelId: string | null;
  objetivo: string;
  tipo: string;
  especialidade: string | null;
  status: StatusCampanha;
  dataInicio: string | null;
  dataFim: string | null;
  audienciaId: string | null;
  agenteIaId: string | null;
  canais: string[];
  metas: MetasCampanha;
  dominio: string | null;
  slug: string | null;
  urlFinal: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  metaAdsCampaignId: string | null;
  googleAdsCampaignId: string | null;
  investimentoPlanejado: number | null;
  investimentoReal: number | null;
  templateOrigem: string | null;
  criadoPor: string | null;
  atualizadoPor: string | null;
  iniciadoPor: string | null;
  pausadoPor: string | null;
  encerradoPor: string | null;
  canceladoPor: string | null;
  createdAt: string;
  updatedAt: string;
  iniciadoEm: string | null;
  pausadoEm: string | null;
  encerradoEm: string | null;
  canceladoEm: string | null;
};

const CAMPANHA_COLUNAS =
  "id, nome, descricao, responsavel_id, objetivo, tipo, especialidade, status, data_inicio, data_fim, audiencia_id, agente_ia_id, metas, dominio, slug, url_final, utm_source, utm_medium, utm_campaign, utm_content, utm_term, meta_ads_campaign_id, google_ads_campaign_id, investimento_planejado, investimento_real, template_origem, criado_por, atualizado_por, iniciado_por, pausado_por, encerrado_por, cancelado_por, created_at, updated_at, iniciado_em, pausado_em, encerrado_em, cancelado_em, campanha_canais(canal)";

type LinhaCampanha = Record<string, unknown> & { campanha_canais?: { canal: string }[] | null };

function mapCampanha(c: LinhaCampanha): Campanha {
  return {
    id: c.id as string,
    nome: c.nome as string,
    descricao: (c.descricao as string | null) ?? null,
    responsavelId: (c.responsavel_id as string | null) ?? null,
    objetivo: c.objetivo as string,
    tipo: c.tipo as string,
    especialidade: (c.especialidade as string | null) ?? null,
    status: c.status as StatusCampanha,
    dataInicio: (c.data_inicio as string | null) ?? null,
    dataFim: (c.data_fim as string | null) ?? null,
    audienciaId: (c.audiencia_id as string | null) ?? null,
    agenteIaId: (c.agente_ia_id as string | null) ?? null,
    canais: (c.campanha_canais ?? []).map((row) => row.canal),
    metas: (c.metas as MetasCampanha) ?? {},
    dominio: (c.dominio as string | null) ?? null,
    slug: (c.slug as string | null) ?? null,
    urlFinal: (c.url_final as string | null) ?? null,
    utmSource: (c.utm_source as string | null) ?? null,
    utmMedium: (c.utm_medium as string | null) ?? null,
    utmCampaign: (c.utm_campaign as string | null) ?? null,
    utmContent: (c.utm_content as string | null) ?? null,
    utmTerm: (c.utm_term as string | null) ?? null,
    metaAdsCampaignId: (c.meta_ads_campaign_id as string | null) ?? null,
    googleAdsCampaignId: (c.google_ads_campaign_id as string | null) ?? null,
    investimentoPlanejado: (c.investimento_planejado as number | null) ?? null,
    investimentoReal: (c.investimento_real as number | null) ?? null,
    templateOrigem: (c.template_origem as string | null) ?? null,
    criadoPor: (c.criado_por as string | null) ?? null,
    atualizadoPor: (c.atualizado_por as string | null) ?? null,
    iniciadoPor: (c.iniciado_por as string | null) ?? null,
    pausadoPor: (c.pausado_por as string | null) ?? null,
    encerradoPor: (c.encerrado_por as string | null) ?? null,
    canceladoPor: (c.cancelado_por as string | null) ?? null,
    createdAt: c.created_at as string,
    updatedAt: c.updated_at as string,
    iniciadoEm: (c.iniciado_em as string | null) ?? null,
    pausadoEm: (c.pausado_em as string | null) ?? null,
    encerradoEm: (c.encerrado_em as string | null) ?? null,
    canceladoEm: (c.cancelado_em as string | null) ?? null,
  };
}

export type DadosCampanha = {
  nome: string;
  descricao?: string | null;
  responsavelId?: string | null;
  objetivo: string;
  tipo: string;
  especialidade?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
  audienciaId?: string | null;
  agenteIaId?: string | null;
  canais?: string[];
  metas?: MetasCampanha;
  dominio?: string | null;
  slug?: string | null;
  urlFinal?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  metaAdsCampaignId?: string | null;
  googleAdsCampaignId?: string | null;
  investimentoPlanejado?: number | null;
  investimentoReal?: number | null;
  templateOrigem?: string | null;
};

export type ResultadoCampanha = { ok: boolean; id?: string; error?: string };

async function salvarCanais(clinicaId: string, campanhaId: string, canais: string[]): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  await supabase.from("campanha_canais").delete().eq("campanha_id", campanhaId);
  const limpos = [...new Set(canais.map((c) => c.trim()).filter(Boolean))];
  if (limpos.length === 0) return;

  await supabase.from("campanha_canais").insert(
    limpos.map((canal) => ({ campanha_id: campanhaId, clinica_id: clinicaId, canal }))
  );
}

export async function criarCampanha(clinicaId: string, dados: DadosCampanha, criadoPor: string | null): Promise<ResultadoCampanha> {
  const nome = dados.nome.trim();
  if (!nome || !dados.objetivo || !dados.tipo) return { ok: false, error: "campos_obrigatorios" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data, error } = await supabase
    .from("campanhas")
    .insert({
      clinica_id: clinicaId,
      nome,
      descricao: dados.descricao?.trim() || null,
      responsavel_id: dados.responsavelId ?? null,
      objetivo: dados.objetivo,
      tipo: dados.tipo,
      especialidade: dados.especialidade?.trim() || null,
      status: "rascunho",
      data_inicio: dados.dataInicio || null,
      data_fim: dados.dataFim || null,
      audiencia_id: dados.audienciaId ?? null,
      agente_ia_id: dados.agenteIaId ?? null,
      metas: dados.metas ?? {},
      dominio: dados.dominio?.trim() || null,
      slug: dados.slug?.trim() || null,
      url_final: dados.urlFinal?.trim() || null,
      utm_source: dados.utmSource?.trim() || null,
      utm_medium: dados.utmMedium?.trim() || null,
      utm_campaign: dados.utmCampaign?.trim() || null,
      utm_content: dados.utmContent?.trim() || null,
      utm_term: dados.utmTerm?.trim() || null,
      meta_ads_campaign_id: dados.metaAdsCampaignId?.trim() || null,
      google_ads_campaign_id: dados.googleAdsCampaignId?.trim() || null,
      investimento_planejado: dados.investimentoPlanejado ?? null,
      investimento_real: dados.investimentoReal ?? null,
      template_origem: dados.templateOrigem ?? null,
      criado_por: criadoPor,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[campanhas] criar_failed", JSON.stringify({ code: error?.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  const campanhaId = data.id as string;
  if (dados.canais && dados.canais.length > 0) await salvarCanais(clinicaId, campanhaId, dados.canais);

  return { ok: true, id: campanhaId };
}

export type FiltroListaCampanhas = { status?: StatusCampanha };

export async function listarCampanhas(clinicaId: string, filtro?: FiltroListaCampanhas): Promise<Campanha[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase.from("campanhas").select(CAMPANHA_COLUNAS).eq("clinica_id", clinicaId);
  if (filtro?.status) query = query.eq("status", filtro.status);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as LinhaCampanha[]).map(mapCampanha);
}

export async function buscarCampanha(clinicaId: string, id: string): Promise<Campanha | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("campanhas")
    .select(CAMPANHA_COLUNAS)
    .eq("id", id)
    .eq("clinica_id", clinicaId)
    .maybeSingle();

  if (error || !data) return null;
  return mapCampanha(data as LinhaCampanha);
}

export async function atualizarCampanha(
  clinicaId: string,
  id: string,
  dados: Partial<DadosCampanha>,
  atualizadoPor: string | null
): Promise<ResultadoCampanha> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), atualizado_por: atualizadoPor };
  if (dados.nome !== undefined) patch.nome = dados.nome.trim();
  if (dados.descricao !== undefined) patch.descricao = dados.descricao?.trim() || null;
  if (dados.responsavelId !== undefined) patch.responsavel_id = dados.responsavelId;
  if (dados.objetivo !== undefined) patch.objetivo = dados.objetivo;
  if (dados.tipo !== undefined) patch.tipo = dados.tipo;
  if (dados.especialidade !== undefined) patch.especialidade = dados.especialidade?.trim() || null;
  if (dados.dataInicio !== undefined) patch.data_inicio = dados.dataInicio || null;
  if (dados.dataFim !== undefined) patch.data_fim = dados.dataFim || null;
  if (dados.audienciaId !== undefined) patch.audiencia_id = dados.audienciaId;
  if (dados.agenteIaId !== undefined) patch.agente_ia_id = dados.agenteIaId;
  if (dados.metas !== undefined) patch.metas = dados.metas;
  if (dados.dominio !== undefined) patch.dominio = dados.dominio?.trim() || null;
  if (dados.slug !== undefined) patch.slug = dados.slug?.trim() || null;
  if (dados.urlFinal !== undefined) patch.url_final = dados.urlFinal?.trim() || null;
  if (dados.utmSource !== undefined) patch.utm_source = dados.utmSource?.trim() || null;
  if (dados.utmMedium !== undefined) patch.utm_medium = dados.utmMedium?.trim() || null;
  if (dados.utmCampaign !== undefined) patch.utm_campaign = dados.utmCampaign?.trim() || null;
  if (dados.utmContent !== undefined) patch.utm_content = dados.utmContent?.trim() || null;
  if (dados.utmTerm !== undefined) patch.utm_term = dados.utmTerm?.trim() || null;
  if (dados.metaAdsCampaignId !== undefined) patch.meta_ads_campaign_id = dados.metaAdsCampaignId?.trim() || null;
  if (dados.googleAdsCampaignId !== undefined) patch.google_ads_campaign_id = dados.googleAdsCampaignId?.trim() || null;
  if (dados.investimentoPlanejado !== undefined) patch.investimento_planejado = dados.investimentoPlanejado;
  if (dados.investimentoReal !== undefined) patch.investimento_real = dados.investimentoReal;

  const { error } = await supabase.from("campanhas").update(patch).eq("id", id).eq("clinica_id", clinicaId);
  if (error) {
    console.error("[campanhas] atualizar_failed", JSON.stringify({ id, code: error.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  if (dados.canais !== undefined) await salvarCanais(clinicaId, id, dados.canais);

  return { ok: true, id };
}

/** Copia objetivo/tipo/público/canais/metas/UTMs — nunca métricas, eventos ou disparos já executados (item 20 do briefing). */
export async function duplicarCampanha(clinicaId: string, id: string, criadoPor: string | null): Promise<ResultadoCampanha> {
  const original = await buscarCampanha(clinicaId, id);
  if (!original) return { ok: false, error: "not_found" };

  return criarCampanha(
    clinicaId,
    {
      nome: `${original.nome} (cópia)`,
      descricao: original.descricao,
      responsavelId: original.responsavelId,
      objetivo: original.objetivo,
      tipo: original.tipo,
      especialidade: original.especialidade,
      audienciaId: original.audienciaId,
      agenteIaId: original.agenteIaId,
      canais: original.canais,
      metas: original.metas,
      dominio: original.dominio,
      slug: original.slug,
      urlFinal: original.urlFinal,
      utmSource: original.utmSource,
      utmMedium: original.utmMedium,
      utmCampaign: original.utmCampaign,
      utmContent: original.utmContent,
      utmTerm: original.utmTerm,
      metaAdsCampaignId: original.metaAdsCampaignId,
      googleAdsCampaignId: original.googleAdsCampaignId,
      investimentoPlanejado: original.investimentoPlanejado,
    },
    criadoPor
  );
}

/** Só rascunho pode ser apagado de vez — o resto vira `cancelada` (arquivar em vez de apagar). */
export async function excluirCampanha(clinicaId: string, id: string): Promise<ResultadoCampanha> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data, error } = await supabase
    .from("campanhas")
    .delete()
    .eq("id", id)
    .eq("clinica_id", clinicaId)
    .eq("status", "rascunho")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: "persist_failed" };
  if (!data) return { ok: false, error: "so_rascunho_pode_ser_excluido" };
  return { ok: true, id };
}

type CamposTransicao = { por: string; em: string };

const CAMPOS_POR_STATUS: Partial<Record<StatusCampanha, CamposTransicao>> = {
  ativa: { por: "iniciado_por", em: "iniciado_em" },
  pausada: { por: "pausado_por", em: "pausado_em" },
  concluida: { por: "encerrado_por", em: "encerrado_em" },
  cancelada: { por: "cancelado_por", em: "cancelado_em" },
};

async function transicaoSimples(
  clinicaId: string,
  id: string,
  de: StatusCampanha[],
  para: StatusCampanha,
  atendenteId: string | null
): Promise<ResultadoCampanha> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const patch: Record<string, unknown> = { status: para, updated_at: new Date().toISOString() };
  const campos = CAMPOS_POR_STATUS[para];
  if (campos) {
    patch[campos.por] = atendenteId;
    patch[campos.em] = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("campanhas")
    .update(patch)
    .eq("id", id)
    .eq("clinica_id", clinicaId)
    .in("status", de)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[campanhas] transicao_failed", JSON.stringify({ id, para, code: error.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }
  if (!data) return { ok: false, error: "transicao_invalida" };
  return { ok: true, id };
}

export function agendarCampanha(clinicaId: string, id: string, atendenteId: string | null): Promise<ResultadoCampanha> {
  return transicaoSimples(clinicaId, id, ["rascunho"], "agendada", atendenteId);
}
export function iniciarCampanha(clinicaId: string, id: string, atendenteId: string | null): Promise<ResultadoCampanha> {
  return transicaoSimples(clinicaId, id, ["rascunho", "agendada"], "ativa", atendenteId);
}
export function pausarCampanha(clinicaId: string, id: string, atendenteId: string | null): Promise<ResultadoCampanha> {
  return transicaoSimples(clinicaId, id, ["ativa"], "pausada", atendenteId);
}
export function retomarCampanha(clinicaId: string, id: string, atendenteId: string | null): Promise<ResultadoCampanha> {
  return transicaoSimples(clinicaId, id, ["pausada"], "ativa", atendenteId);
}
export function encerrarCampanha(clinicaId: string, id: string, atendenteId: string | null): Promise<ResultadoCampanha> {
  return transicaoSimples(clinicaId, id, ["ativa", "pausada"], "concluida", atendenteId);
}
export function cancelarCampanha(clinicaId: string, id: string, atendenteId: string | null): Promise<ResultadoCampanha> {
  return transicaoSimples(clinicaId, id, ["rascunho", "agendada", "ativa", "pausada"], "cancelada", atendenteId);
}
