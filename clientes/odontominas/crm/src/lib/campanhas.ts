import { getSupabaseServerClient } from "@/lib/supabase";
import { resolverAudiencia, type CandidatoAudiencia, type FiltroAudiencia } from "@/lib/audiencias";

/**
 * Disparos — Fase B: campanha (wizard + worker de envio, ver
 * src/lib/disparos-worker.ts). `criarCampanha` congela, no momento da
 * criação, tanto o filtro/texto usado quanto a lista de destinatários
 * elegíveis (via `resolverAudiencia`, motor da Fase A) — uma campanha nunca
 * re-resolve o público depois de criada, mesmo que ela leve horas pra
 * terminar de enviar.
 */

export type StatusCampanha = "rascunho" | "enviando" | "pausada" | "concluida" | "cancelada";
export type StatusDestinatario = "pendente" | "enviado" | "falha" | "pulado_opt_out" | "telefone_invalido" | "cancelado";

export type Campanha = {
  id: string;
  nome: string;
  mensagemSalvaId: string | null;
  mensagemTexto: string;
  audienciaId: string | null;
  filtro: FiltroAudiencia;
  status: StatusCampanha;
  totalDestinatarios: number;
  totalEnviados: number;
  totalFalhas: number;
  totalPulados: number;
  criadoPor: string | null;
  createdAt: string;
  updatedAt: string;
  iniciadoEm: string | null;
  concluidoEm: string | null;
};

export type CampanhaDestinatario = {
  id: string;
  pacienteId: string;
  conversaId: string | null;
  telefone: string;
  nome: string | null;
  ordem: number;
  status: StatusDestinatario;
  enviadoEm: string | null;
  erro: string | null;
  evolutionMessageId: string | null;
};

const CAMPANHA_COLUNAS =
  "id, nome, mensagem_salva_id, mensagem_texto, audiencia_id, filtro, status, total_destinatarios, total_enviados, total_falhas, total_pulados, criado_por, created_at, updated_at, iniciado_em, concluido_em";

function mapCampanha(c: Record<string, unknown>): Campanha {
  return {
    id: c.id as string,
    nome: c.nome as string,
    mensagemSalvaId: (c.mensagem_salva_id as string | null) ?? null,
    mensagemTexto: c.mensagem_texto as string,
    audienciaId: (c.audiencia_id as string | null) ?? null,
    filtro: (c.filtro as FiltroAudiencia) ?? {},
    status: c.status as StatusCampanha,
    totalDestinatarios: (c.total_destinatarios as number | null) ?? 0,
    totalEnviados: (c.total_enviados as number | null) ?? 0,
    totalFalhas: (c.total_falhas as number | null) ?? 0,
    totalPulados: (c.total_pulados as number | null) ?? 0,
    criadoPor: (c.criado_por as string | null) ?? null,
    createdAt: c.created_at as string,
    updatedAt: c.updated_at as string,
    iniciadoEm: (c.iniciado_em as string | null) ?? null,
    concluidoEm: (c.concluido_em as string | null) ?? null,
  };
}

function mapDestinatario(d: Record<string, unknown>): CampanhaDestinatario {
  return {
    id: d.id as string,
    pacienteId: d.paciente_id as string,
    conversaId: (d.conversa_id as string | null) ?? null,
    telefone: d.telefone as string,
    nome: (d.nome as string | null) ?? null,
    ordem: d.ordem as number,
    status: d.status as StatusDestinatario,
    enviadoEm: (d.enviado_em as string | null) ?? null,
    erro: (d.erro as string | null) ?? null,
    evolutionMessageId: (d.evolution_message_id as string | null) ?? null,
  };
}

/** Jitter entre mensagens de uma campanha — WhatsApp via Evolution shadowbana número que manda rápido demais. */
export function intervaloEnvioMs(min = 15_000, max = 25_000): number {
  return Math.floor(min + Math.random() * (max - min));
}

export type LinhaDestinatarioNova = {
  paciente_id: string;
  conversa_id: string | null;
  telefone: string;
  nome: string | null;
  ordem: number;
  status: "pendente";
};

/** Regra pura: snapshot do público elegível em linhas de destinatário, com ordem de envio determinística. */
export function montarLinhasDestinatarios(elegiveis: CandidatoAudiencia[]): LinhaDestinatarioNova[] {
  return elegiveis.map((c, indice) => ({
    paciente_id: c.pacienteId,
    conversa_id: c.conversaId,
    telefone: c.telefone,
    nome: c.nome,
    ordem: indice,
    status: "pendente",
  }));
}

export type DadosNovaCampanha = {
  nome: string;
  filtro: FiltroAudiencia;
  audienciaId: string | null;
  mensagemSalvaId: string | null;
  mensagemTexto: string;
  iniciarAgora: boolean;
};

export type ResultadoCriarCampanha = { ok: boolean; id?: string; error?: string };

export async function criarCampanha(
  clinicaId: string,
  dados: DadosNovaCampanha,
  criadoPor: string | null
): Promise<ResultadoCriarCampanha> {
  const nome = dados.nome.trim();
  const mensagemTexto = dados.mensagemTexto.trim();
  if (!nome || !mensagemTexto) return { ok: false, error: "campos_obrigatorios" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const publico = await resolverAudiencia(clinicaId, dados.filtro);
  if (publico.elegiveis.length === 0) return { ok: false, error: "sem_destinatarios" };

  // Nasce sempre 'rascunho': só vira 'enviando' depois que os destinatários
  // existirem de verdade, pra o worker nunca pegar uma campanha "no ar" sem
  // ninguém pra mandar mensagem.
  const { data: campanha, error: erroCampanha } = await supabase
    .from("campanhas")
    .insert({
      clinica_id: clinicaId,
      nome,
      mensagem_salva_id: dados.mensagemSalvaId,
      mensagem_texto: mensagemTexto,
      audiencia_id: dados.audienciaId,
      filtro: dados.filtro,
      status: "rascunho",
      total_destinatarios: publico.elegiveis.length,
      criado_por: criadoPor,
    })
    .select("id")
    .single();

  if (erroCampanha || !campanha) {
    console.error("[campanhas] criar_failed", JSON.stringify({ code: erroCampanha?.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  const campanhaId = campanha.id as string;
  const linhas = montarLinhasDestinatarios(publico.elegiveis).map((linha) => ({
    ...linha,
    campanha_id: campanhaId,
    clinica_id: clinicaId,
  }));

  const { error: erroDestinatarios } = await supabase.from("campanha_destinatarios").insert(linhas);
  if (erroDestinatarios) {
    console.error(
      "[campanhas] inserir_destinatarios_failed",
      JSON.stringify({ campanhaId, code: erroDestinatarios.code ?? null })
    );
    return { ok: false, error: "persist_failed" };
  }

  if (dados.iniciarAgora) {
    const agora = new Date().toISOString();
    await supabase
      .from("campanhas")
      .update({ status: "enviando", iniciado_em: agora, updated_at: agora })
      .eq("id", campanhaId);
  }

  return { ok: true, id: campanhaId };
}

export async function listarCampanhas(clinicaId: string): Promise<Campanha[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("campanhas")
    .select(CAMPANHA_COLUNAS)
    .eq("clinica_id", clinicaId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(mapCampanha);
}

export type CampanhaComRelatorio = Campanha & { destinatarios: CampanhaDestinatario[] };

export async function buscarCampanhaComRelatorio(clinicaId: string, id: string): Promise<CampanhaComRelatorio | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data: campanha, error } = await supabase
    .from("campanhas")
    .select(CAMPANHA_COLUNAS)
    .eq("id", id)
    .eq("clinica_id", clinicaId)
    .maybeSingle();

  if (error || !campanha) return null;

  const { data: destinatarios } = await supabase
    .from("campanha_destinatarios")
    .select("id, paciente_id, conversa_id, telefone, nome, ordem, status, enviado_em, erro, evolution_message_id")
    .eq("campanha_id", id)
    .order("ordem", { ascending: true });

  return { ...mapCampanha(campanha), destinatarios: (destinatarios ?? []).map(mapDestinatario) };
}

export type ResultadoTransicao = { ok: boolean; error?: string };

async function transicaoSimples(
  clinicaId: string,
  id: string,
  de: StatusCampanha[],
  para: StatusCampanha,
  extra?: Record<string, unknown>
): Promise<ResultadoTransicao> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data, error } = await supabase
    .from("campanhas")
    .update({ status: para, updated_at: new Date().toISOString(), ...extra })
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
  return { ok: true };
}

export function iniciarCampanha(clinicaId: string, id: string): Promise<ResultadoTransicao> {
  return transicaoSimples(clinicaId, id, ["rascunho"], "enviando", { iniciado_em: new Date().toISOString() });
}

export function pausarCampanha(clinicaId: string, id: string): Promise<ResultadoTransicao> {
  return transicaoSimples(clinicaId, id, ["enviando"], "pausada");
}

export function retomarCampanha(clinicaId: string, id: string): Promise<ResultadoTransicao> {
  return transicaoSimples(clinicaId, id, ["pausada"], "enviando");
}

export async function cancelarCampanha(clinicaId: string, id: string): Promise<ResultadoTransicao> {
  const resultado = await transicaoSimples(clinicaId, id, ["rascunho", "enviando", "pausada"], "cancelada");
  if (!resultado.ok) return resultado;

  const supabase = getSupabaseServerClient();
  if (!supabase) return resultado;

  await supabase
    .from("campanha_destinatarios")
    .update({ status: "cancelado", updated_at: new Date().toISOString() })
    .eq("campanha_id", id)
    .eq("status", "pendente");

  return resultado;
}
