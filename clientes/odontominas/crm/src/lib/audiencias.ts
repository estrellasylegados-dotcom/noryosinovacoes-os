import { getSupabaseServerClient } from "@/lib/supabase";
import { normalizarTelefoneEntrada } from "@/lib/chat";
import { isStatusValido, type StatusConversa } from "@/lib/status";

/**
 * Motor de públicos ("Audiências") — Fase A de Disparos. Pensado pra ser
 * consumido por qualquer módulo que precise mandar mensagem em massa
 * (Disparos primeiro; Automações/Funil/IA depois, mesma regra — não é
 * exclusivo de Disparos). Filtro é estruturado (jsonb com forma conhecida),
 * nunca SQL livre, pra ficar auditável e testável isolado, no mesmo espírito
 * de `funil.ts`/`reativacao.ts`: regra pura testável (`resolverPublico`) +
 * uma função de orquestração que fala com o Supabase (`resolverAudiencia`).
 *
 * V1 cobre só o que o schema atual sustenta de verdade: etiqueta, status da
 * conversa, inatividade por dias sem mensagem. Opt-out e telefone inválido
 * são SEMPRE excluídos, em qualquer filtro — não são opção, são regra.
 */

export type FiltroAudiencia = {
  etiquetaIds?: string[];
  etiquetaModo?: "todas" | "qualquer";
  statusConversa?: StatusConversa[];
  /** Sem mensagem (ultima_mensagem_em) há pelo menos N dias. */
  inativoHaDias?: number;
};

export type CandidatoAudiencia = {
  pacienteId: string;
  conversaId: string | null;
  telefone: string;
  nome: string | null;
  statusConversa: StatusConversa | null;
  ultimaMensagemEm: string | null;
  etiquetaIds: string[];
  optOutEm: string | null;
};

export type MotivoExclusaoAudiencia = "opt_out" | "telefone_invalido";

export type ResultadoPublico = {
  totalEncontrados: number;
  excluidos: { candidato: CandidatoAudiencia; motivo: MotivoExclusaoAudiencia }[];
  elegiveis: CandidatoAudiencia[];
};

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Só decide se o candidato bate no segmento pedido — opt-out/telefone entram depois, em `resolverPublico`. */
export function pacienteAtendeSegmento(candidato: CandidatoAudiencia, filtro: FiltroAudiencia, agoraMs: number): boolean {
  if (filtro.statusConversa && filtro.statusConversa.length > 0) {
    if (!candidato.statusConversa || !filtro.statusConversa.includes(candidato.statusConversa)) return false;
  }

  if (filtro.etiquetaIds && filtro.etiquetaIds.length > 0) {
    const modo = filtro.etiquetaModo ?? "qualquer";
    const bateEtiqueta =
      modo === "todas"
        ? filtro.etiquetaIds.every((id) => candidato.etiquetaIds.includes(id))
        : filtro.etiquetaIds.some((id) => candidato.etiquetaIds.includes(id));
    if (!bateEtiqueta) return false;
  }

  if (filtro.inativoHaDias !== undefined) {
    if (!candidato.ultimaMensagemEm) return false;
    const diasSemMensagem = (agoraMs - new Date(candidato.ultimaMensagemEm).getTime()) / MS_POR_DIA;
    if (diasSemMensagem < filtro.inativoHaDias) return false;
  }

  return true;
}

/**
 * Regra pura e testável: aplica o segmento e, só sobre quem bateu, separa
 * exclusão obrigatória (opt-out, telefone inválido) de elegível de verdade.
 * "Encontrados" conta quem bate no segmento ANTES da exclusão — é o número
 * que a tela mostra antes de "excluídos"/"elegíveis" (ex.: 532/41/491).
 */
export function resolverPublico(candidatos: CandidatoAudiencia[], filtro: FiltroAudiencia, agoraMs: number): ResultadoPublico {
  const encontrados = candidatos.filter((c) => pacienteAtendeSegmento(c, filtro, agoraMs));

  const excluidos: ResultadoPublico["excluidos"] = [];
  const elegiveis: CandidatoAudiencia[] = [];

  for (const candidato of encontrados) {
    if (candidato.optOutEm) {
      excluidos.push({ candidato, motivo: "opt_out" });
      continue;
    }
    if (!normalizarTelefoneEntrada(candidato.telefone)) {
      excluidos.push({ candidato, motivo: "telefone_invalido" });
      continue;
    }
    elegiveis.push(candidato);
  }

  return { totalEncontrados: encontrados.length, excluidos, elegiveis };
}

async function buscarCandidatos(clinicaId: string): Promise<CandidatoAudiencia[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data: pacientesRows, error } = await supabase
    .from("pacientes")
    .select("id, nome, telefone, opt_out_em, conversas(id, status, ultima_mensagem_em)")
    .eq("clinica_id", clinicaId);

  if (error || !pacientesRows) {
    console.error("[audiencias] buscar_candidatos_failed", JSON.stringify({ code: error?.code ?? null }));
    return [];
  }

  const conversaIds = pacientesRows
    .map((p) => {
      const conversas = p.conversas as { id: string }[] | null;
      return conversas?.[0]?.id ?? null;
    })
    .filter((id): id is string => Boolean(id));

  const etiquetasPorConversa = new Map<string, string[]>();
  if (conversaIds.length > 0) {
    const { data: linksRows } = await supabase
      .from("conversa_etiquetas")
      .select("conversa_id, etiqueta_id")
      .in("conversa_id", conversaIds);

    for (const link of linksRows ?? []) {
      const conversaId = link.conversa_id as string;
      const lista = etiquetasPorConversa.get(conversaId) ?? [];
      lista.push(link.etiqueta_id as string);
      etiquetasPorConversa.set(conversaId, lista);
    }
  }

  return pacientesRows.map((p) => {
    const conversas = p.conversas as { id: string; status: string; ultima_mensagem_em: string | null }[] | null;
    const conversa = conversas?.[0] ?? null;
    const statusBruto = conversa?.status ?? null;

    return {
      pacienteId: p.id as string,
      conversaId: conversa?.id ?? null,
      telefone: p.telefone as string,
      nome: (p.nome as string | null) ?? null,
      statusConversa: statusBruto && isStatusValido(statusBruto) ? (statusBruto as StatusConversa) : null,
      ultimaMensagemEm: conversa?.ultima_mensagem_em ?? null,
      etiquetaIds: conversa ? etiquetasPorConversa.get(conversa.id) ?? [] : [],
      optOutEm: (p.opt_out_em as string | null) ?? null,
    };
  });
}

export async function resolverAudiencia(clinicaId: string, filtro: FiltroAudiencia): Promise<ResultadoPublico> {
  const candidatos = await buscarCandidatos(clinicaId);
  return resolverPublico(candidatos, filtro, Date.now());
}

export type Audiencia = {
  id: string;
  nome: string;
  descricao: string | null;
  filtro: FiltroAudiencia;
  ultimaContagem: number | null;
  ultimaResolucaoEm: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listarAudiencias(clinicaId: string): Promise<Audiencia[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("audiencias")
    .select("id, nome, descricao, filtro, ultima_contagem, ultima_resolucao_em, created_at, updated_at")
    .eq("clinica_id", clinicaId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((a) => ({
    id: a.id as string,
    nome: a.nome as string,
    descricao: (a.descricao as string | null) ?? null,
    filtro: (a.filtro as FiltroAudiencia) ?? {},
    ultimaContagem: (a.ultima_contagem as number | null) ?? null,
    ultimaResolucaoEm: (a.ultima_resolucao_em as string | null) ?? null,
    createdAt: a.created_at as string,
    updatedAt: a.updated_at as string,
  }));
}

export type ResultadoAudiencia = { ok: boolean; id?: string; error?: string };

export async function salvarAudiencia(
  clinicaId: string,
  nome: string,
  descricao: string | null,
  filtro: FiltroAudiencia,
  criadoPor: string | null
): Promise<ResultadoAudiencia> {
  const nomeLimpo = nome.trim();
  if (!nomeLimpo) return { ok: false, error: "campos_obrigatorios" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const resultado = await resolverAudiencia(clinicaId, filtro);
  const agora = new Date().toISOString();

  const { data, error } = await supabase
    .from("audiencias")
    .insert({
      clinica_id: clinicaId,
      nome: nomeLimpo,
      descricao,
      filtro,
      ultima_contagem: resultado.elegiveis.length,
      ultima_resolucao_em: agora,
      criado_por: criadoPor,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[audiencias] salvar_failed", JSON.stringify({ code: error?.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }
  return { ok: true, id: data.id as string };
}
