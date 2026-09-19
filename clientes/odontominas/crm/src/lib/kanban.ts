import { getSupabaseServerClient } from "@/lib/supabase";
import { buscarStatusSlaLista } from "@/lib/sla";
import { registrarEvento } from "@/lib/auditoria";
import { resolverPorEvento } from "@/lib/alertas";
import { emitirEventoAutomacao } from "@/lib/fluxo-eventos-internos";
import { buscarAtendenteCompletoPorId } from "@/lib/atendentes";
import { destinoElegivel, type AtorConversa } from "@/lib/atribuicao";
import { resolverPermissoes } from "@/lib/permissoes";
import {
  EVENTO_KANBAN_ESTAGIO,
  eventoAuditoriaMovimento,
  filtrarCards,
  montarPayloadEstagioAlterado,
  podeMoverCard,
  podeVerCard,
  slaParaKanban,
  veTodosOsCards,
  type CardKanban,
  type ErroKanban,
  type FiltrosKanban,
  type OrigemMudanca,
  type TipoEstagio,
} from "@/lib/kanban-regras";

/**
 * Kanban comercial — I/O. Toda MUDANÇA passa pelas funções Postgres da
 * migration v33/v34 (conditional update por `versao` + histórico na mesma
 * transação); aqui ficam só a leitura enxuta do board (sem mensagens), a
 * checagem de permissão/visibilidade (backend é a autoridade) e os efeitos
 * colaterais best-effort (auditoria + evento interno) que só rodam DEPOIS da
 * persistência. Se o Kanban falhar, o Chat segue funcionando: nada em
 * conversas/pacientes depende dele.
 */

type Supabase = NonNullable<ReturnType<typeof getSupabaseServerClient>>;
type Linha = Record<string, unknown>;
type Embutido<T> = T | T[] | null;

export type Estagio = { id: string; nome: string; ordem: number; tipo: TipoEstagio; cor: string | null };
export type MotivoPerda = { id: string; nome: string };
export type PipelineResumo = { id: string; nome: string; padrao: boolean };

export type BoardKanban = {
  pipeline: PipelineResumo;
  pipelines: PipelineResumo[];
  estagios: Estagio[];
  cards: CardKanban[];
  motivosPerda: MotivoPerda[];
  /** true quando algum limite de carga cortou cards (fechados: mais recentes; abertos: mais recentes por estágio). */
  truncado: boolean;
  geradoEm: string;
};

export const LIMITE_CARDS_ABERTOS = 500;
export const LIMITE_CARDS_FECHADOS = 100;

const um = <T>(v: Embutido<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

async function emLotes<T, R>(itens: T[], tamanho: number, fn: (lote: T[]) => Promise<R[]>): Promise<R[]> {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += tamanho) saida.push(...(await fn(itens.slice(i, i + tamanho))));
  return saida;
}

const SELECT_OPORTUNIDADE =
  "id, paciente_id, pipeline_id, estagio_id, responsavel_id, conversa_id, interesse, status, versao, estagio_entrou_em, created_at, motivo_perda_obs, " +
  "pacientes(nome, telefone, origem_lead, utm_source, campanha_id), atendentes(nome), motivos_perda(nome), " +
  "conversas(canal_id, status, mensagens_nao_lidas, ultima_mensagem_em, canais(nome))";

// ---------------------------------------------------------------------------
// Pipeline / estágios
// ---------------------------------------------------------------------------

async function resolverPipeline(supabase: Supabase, clinicaId: string, pipelineId?: string): Promise<{ pipelines: PipelineResumo[]; atual: PipelineResumo } | null> {
  // Garante o pipeline padrão (idempotente) — clínica nova nunca cai em tela vazia.
  await supabase.rpc("garantir_pipeline_padrao", { p_clinica: clinicaId });
  const { data } = await supabase.from("pipelines").select("id, nome, padrao").eq("clinica_id", clinicaId).eq("ativo", true).order("created_at");
  const pipelines = ((data ?? []) as Linha[]).map((p) => ({ id: p.id as string, nome: p.nome as string, padrao: Boolean(p.padrao) }));
  const atual = pipelines.find((p) => p.id === pipelineId) ?? pipelines.find((p) => p.padrao) ?? pipelines[0];
  return atual ? { pipelines, atual } : null;
}

async function listarEstagios(supabase: Supabase, clinicaId: string, pipelineId: string): Promise<Estagio[]> {
  const { data } = await supabase
    .from("pipeline_estagios")
    .select("id, nome, ordem, tipo, cor")
    .eq("clinica_id", clinicaId)
    .eq("pipeline_id", pipelineId)
    .eq("ativo", true)
    .order("ordem");
  return ((data ?? []) as Linha[]).map((e) => ({ id: e.id as string, nome: e.nome as string, ordem: e.ordem as number, tipo: e.tipo as TipoEstagio, cor: (e.cor as string | null) ?? null }));
}

async function listarMotivos(supabase: Supabase, clinicaId: string): Promise<MotivoPerda[]> {
  const { data } = await supabase.from("motivos_perda").select("id, nome").eq("clinica_id", clinicaId).eq("ativo", true).order("ordem");
  return ((data ?? []) as Linha[]).map((m) => ({ id: m.id as string, nome: m.nome as string }));
}

// ---------------------------------------------------------------------------
// Montagem dos cards (só o necessário: nada de mensagens)
// ---------------------------------------------------------------------------

async function montarCards(supabase: Supabase, clinicaId: string, linhas: Linha[], agora: Date): Promise<CardKanban[]> {
  if (linhas.length === 0) return [];

  const pacienteIds = [...new Set(linhas.map((l) => l.paciente_id as string))];

  // Tags = etiquetas já existentes (por conversa); o card mostra a união das conversas do paciente.
  const conversasDosPacientes = await emLotes(pacienteIds, 100, async (lote) => {
    const { data } = await supabase.from("conversas").select("id, paciente_id").eq("clinica_id", clinicaId).in("paciente_id", lote);
    return (data ?? []) as Linha[];
  });
  const pacientePorConversa = new Map(conversasDosPacientes.map((c) => [c.id as string, c.paciente_id as string]));
  const links = await emLotes([...pacientePorConversa.keys()], 100, async (lote) => {
    const { data } = await supabase.from("conversa_etiquetas").select("conversa_id, etiquetas(id, nome, cor)").in("conversa_id", lote);
    return (data ?? []) as Linha[];
  });
  const etiquetasPorPaciente = new Map<string, Map<string, { id: string; nome: string; cor: string }>>();
  for (const l of links) {
    const pacienteId = pacientePorConversa.get(l.conversa_id as string);
    const e = um(l.etiquetas as Embutido<{ id: string; nome: string; cor: string }>);
    if (!pacienteId || !e) continue;
    if (!etiquetasPorPaciente.has(pacienteId)) etiquetasPorPaciente.set(pacienteId, new Map());
    etiquetasPorPaciente.get(pacienteId)!.set(e.id, e);
  }

  // SLA: serviço existente (nada é recalculado aqui) — lista de conversas com ciclo potencial.
  const sla = new Map((await buscarStatusSlaLista(clinicaId, agora)).map((i) => [i.conversaId, i.status]));

  return linhas.map((l) => {
    const paciente = um(l.pacientes as Embutido<Linha>);
    const resp = um(l.atendentes as Embutido<Linha>);
    const motivo = um(l.motivos_perda as Embutido<Linha>);
    const conversa = um(l.conversas as Embutido<Linha>);
    const canal = conversa ? um(conversa.canais as Embutido<Linha>) : null;
    const conversaId = (l.conversa_id as string | null) ?? null;
    const aberta = l.status === "open";
    return {
      id: l.id as string,
      pacienteId: l.paciente_id as string,
      pacienteNome: (paciente?.nome as string | null) ?? null,
      telefone: (paciente?.telefone as string | null) ?? null,
      interesse: (l.interesse as string | null) ?? null,
      estagioId: l.estagio_id as string,
      status: l.status as CardKanban["status"],
      versao: l.versao as number,
      responsavelId: (l.responsavel_id as string | null) ?? null,
      responsavelNome: (resp?.nome as string | null) ?? null,
      conversaId,
      canalId: (conversa?.canal_id as string | null) ?? null,
      canalNome: (canal?.nome as string | null) ?? null,
      origem: ((paciente?.origem_lead as string | null) ?? (paciente?.utm_source as string | null)) ?? null,
      campanhaId: (paciente?.campanha_id as string | null) ?? null,
      etiquetas: [...(etiquetasPorPaciente.get(l.paciente_id as string)?.values() ?? [])],
      sla: aberta && conversaId ? slaParaKanban(sla.get(conversaId)) : null,
      statusConversa: (conversa?.status as string | null) ?? null,
      naoLidas: (conversa?.mensagens_nao_lidas as number | null) ?? 0,
      ultimaInteracaoEm: (conversa?.ultima_mensagem_em as string | null) ?? null,
      estagioEntrouEm: l.estagio_entrou_em as string,
      criadoEm: l.created_at as string,
      motivoPerda: (motivo?.nome as string | null) ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export async function buscarBoard(
  clinicaId: string,
  ator: AtorConversa,
  filtros: FiltrosKanban & { pipelineId?: string } = {},
  agora: Date = new Date()
): Promise<{ ok: true; board: BoardKanban } | { ok: false; error: ErroKanban }> {
  if (!ator.permissoes.has("kanban.visualizar")) return { ok: false, error: "forbidden" };
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const p = await resolverPipeline(supabase, clinicaId, filtros.pipelineId);
  if (!p) return { ok: false, error: "backend_unavailable" };

  const base = () => {
    let q = supabase.from("oportunidades").select(SELECT_OPORTUNIDADE).eq("clinica_id", clinicaId).eq("pipeline_id", p.atual.id);
    // Visão por perfil: quem não vê tudo enxerga os próprios + os sem responsável (mesma regra do Chat).
    if (!veTodosOsCards(ator)) q = q.or(`responsavel_id.is.null,responsavel_id.eq.${ator.atendenteId}`);
    return q;
  };

  const [estagios, motivosPerda, abertas, fechadas] = await Promise.all([
    listarEstagios(supabase, clinicaId, p.atual.id),
    listarMotivos(supabase, clinicaId),
    base().eq("status", "open").order("estagio_entrou_em", { ascending: false }).limit(LIMITE_CARDS_ABERTOS),
    base().in("status", ["won", "lost"]).order("updated_at", { ascending: false }).limit(LIMITE_CARDS_FECHADOS),
  ]);

  if (abertas.error || fechadas.error) {
    console.error("[kanban] board_failed", JSON.stringify({ code: abertas.error?.code ?? fechadas.error?.code ?? null }));
    return { ok: false, error: "backend_unavailable" };
  }

  const linhas = [...((abertas.data ?? []) as unknown as Linha[]), ...((fechadas.data ?? []) as unknown as Linha[])];
  const cards = filtrarCards(await montarCards(supabase, clinicaId, linhas, agora), filtros);

  return {
    ok: true,
    board: {
      pipeline: p.atual,
      pipelines: p.pipelines,
      estagios,
      cards,
      motivosPerda,
      truncado: (abertas.data?.length ?? 0) >= LIMITE_CARDS_ABERTOS || (fechadas.data?.length ?? 0) >= LIMITE_CARDS_FECHADOS,
      geradoEm: agora.toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Detalhe (card + histórico de estágio)
// ---------------------------------------------------------------------------

export type EntradaHistorico = {
  id: string;
  tipo: "created" | "stage_changed" | "owner_changed";
  estagioDe: string | null;
  estagioPara: string | null;
  responsavelDe: string | null;
  responsavelPara: string | null;
  motivoPerda: string | null;
  observacao: string | null;
  atorNome: string | null;
  origem: OrigemMudanca;
  em: string;
};

export type DetalheOportunidade = { card: CardKanban; historico: EntradaHistorico[]; estagios: Estagio[]; motivosPerda: MotivoPerda[] };

async function carregarLinha(supabase: Supabase, clinicaId: string, id: string): Promise<Linha | null> {
  const { data } = await supabase.from("oportunidades").select(SELECT_OPORTUNIDADE).eq("id", id).eq("clinica_id", clinicaId).maybeSingle();
  return (data as unknown as Linha | null) ?? null;
}

export async function buscarDetalheOportunidade(
  clinicaId: string,
  ator: AtorConversa,
  id: string
): Promise<{ ok: true; detalhe: DetalheOportunidade } | { ok: false; error: ErroKanban }> {
  if (!ator.permissoes.has("kanban.visualizar")) return { ok: false, error: "forbidden" };
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const linha = await carregarLinha(supabase, clinicaId, id);
  if (!linha) return { ok: false, error: "not_found" };
  if (!podeVerCard(ator, (linha.responsavel_id as string | null) ?? null)) return { ok: false, error: "forbidden" };

  const [cards, estagios, motivosPerda, hist] = await Promise.all([
    montarCards(supabase, clinicaId, [linha], new Date()),
    listarEstagios(supabase, clinicaId, linha.pipeline_id as string),
    listarMotivos(supabase, clinicaId),
    supabase
      .from("oportunidade_historico")
      .select("id, tipo, estagio_de, estagio_para, responsavel_de, responsavel_para, observacao, origem, created_at, motivos_perda(nome), ator:atendentes!oportunidade_historico_ator_id_fkey(nome)")
      .eq("oportunidade_id", id)
      .eq("clinica_id", clinicaId)
      .order("created_at", { ascending: true }),
  ]);

  const nomes = new Map<string, string>();
  const idsResp = new Set<string>();
  for (const h of (hist.data ?? []) as unknown as Linha[]) {
    for (const k of ["responsavel_de", "responsavel_para"]) if (h[k]) idsResp.add(h[k] as string);
  }
  if (idsResp.size > 0) {
    const { data } = await supabase.from("atendentes").select("id, nome").in("id", [...idsResp]);
    for (const a of (data ?? []) as Linha[]) nomes.set(a.id as string, a.nome as string);
  }

  const historico: EntradaHistorico[] = ((hist.data ?? []) as unknown as Linha[]).map((h) => ({
    id: h.id as string,
    tipo: h.tipo as EntradaHistorico["tipo"],
    estagioDe: (h.estagio_de as string | null) ?? null,
    estagioPara: (h.estagio_para as string | null) ?? null,
    responsavelDe: h.responsavel_de ? (nomes.get(h.responsavel_de as string) ?? null) : null,
    responsavelPara: h.responsavel_para ? (nomes.get(h.responsavel_para as string) ?? null) : null,
    motivoPerda: (um(h.motivos_perda as Embutido<Linha>)?.nome as string | null) ?? null,
    observacao: (h.observacao as string | null) ?? null,
    atorNome: (um(h.ator as Embutido<Linha>)?.nome as string | null) ?? null,
    origem: h.origem as OrigemMudanca,
    em: h.created_at as string,
  }));

  return { ok: true, detalhe: { card: cards[0], historico, estagios, motivosPerda } };
}

// ---------------------------------------------------------------------------
// Criar
// ---------------------------------------------------------------------------

type RespostaRpc = Record<string, unknown> & { ok?: boolean; error?: string };

/**
 * Nasce quando entra a 1ª conversa VÁLIDA de um paciente sem oportunidade
 * aberta (webhook / conversa iniciada pelo painel). `conversaNova=false`
 * (mensagem numa conversa antiga) só cria se o paciente NUNCA teve
 * oportunidade — não ressuscita lead ganho/perdido a cada mensagem.
 * Best-effort: nunca derruba webhook/envio (Chat independe do Kanban).
 */
export async function garantirOportunidadeDaConversa(
  clinicaId: string,
  pacienteId: string,
  conversaId: string,
  opcoes: { conversaNova: boolean; atorId?: string | null }
): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return;
    const { data, error } = await supabase.rpc("criar_oportunidade", {
      p_clinica: clinicaId,
      p_paciente: pacienteId,
      p_conversa: conversaId,
      p_ator: opcoes.atorId ?? null,
      p_origem: "sistema",
      p_interesse: null,
      p_reabrir_ciclo: opcoes.conversaNova,
    });
    const r = data as RespostaRpc | null;
    if (error || !r?.ok) {
      console.error("[kanban] criar_auto_failed", JSON.stringify({ code: (error as { code?: string } | null)?.code ?? null, erro: r?.error ?? null }));
      return;
    }
    if (r.criada) {
      await registrarEvento({ clinicaId, atorId: opcoes.atorId ?? null, evento: "OPPORTUNITY_CREATED", alvoId: r.oportunidade_id as string, detalhes: { origem: "sistema", pacienteId } });
    }
  } catch (e) {
    console.error("[kanban] criar_auto_error", JSON.stringify({ message: (e as Error).message }));
  }
}

export async function criarOportunidadeManual(
  clinicaId: string,
  ator: AtorConversa,
  pacienteId: string,
  interesse: string | null
): Promise<{ ok: true; oportunidadeId: string } | { ok: false; error: ErroKanban; oportunidadeId?: string }> {
  if (!ator.permissoes.has("kanban.mover")) return { ok: false, error: "forbidden" };
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data: conv } = await supabase
    .from("conversas")
    .select("id")
    .eq("clinica_id", clinicaId)
    .eq("paciente_id", pacienteId)
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase.rpc("criar_oportunidade", {
    p_clinica: clinicaId,
    p_paciente: pacienteId,
    p_conversa: (conv?.id as string | undefined) ?? null,
    p_ator: ator.atendenteId,
    p_origem: "manual",
    p_interesse: interesse,
    p_reabrir_ciclo: true,
  });
  const r = data as RespostaRpc | null;
  if (error || !r) return { ok: false, error: "rpc_failed" };
  if (!r.ok) return { ok: false, error: (r.error as ErroKanban) ?? "rpc_failed" };
  if (!r.criada) return { ok: false, error: "ja_existe_aberta" };

  await registrarEvento({ clinicaId, atorId: ator.atendenteId, atorPerfil: ator.perfil, evento: "OPPORTUNITY_CREATED", alvoId: r.oportunidade_id as string, detalhes: { origem: "manual", pacienteId } });
  return { ok: true, oportunidadeId: r.oportunidade_id as string };
}

// ---------------------------------------------------------------------------
// Mover (estágio) — backend valida sessão/clínica/permissão/pipeline/estágio/versão
// ---------------------------------------------------------------------------

export type EntradaMover = {
  estagioId: string;
  versaoEsperada: number;
  motivoPerdaId?: string | null;
  observacao?: string | null;
  /** Retry da mesma operação (mesma chave) não duplica histórico nem evento. */
  idempotencyKey?: string | null;
  origem?: OrigemMudanca;
};

export type ResultadoMover =
  | { ok: true; versao: number; estagioId: string; status: string; semMudanca?: boolean; idempotente?: boolean }
  | { ok: false; error: ErroKanban; versaoAtual?: number; estagioAtual?: string };

export async function moverOportunidade(clinicaId: string, ator: AtorConversa, id: string, entrada: EntradaMover): Promise<ResultadoMover> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };
  if (!Number.isInteger(entrada.versaoEsperada)) return { ok: false, error: "invalid_body" };

  const { data: atual } = await supabase.from("oportunidades").select("responsavel_id").eq("id", id).eq("clinica_id", clinicaId).maybeSingle();
  if (!atual) return { ok: false, error: "not_found" };
  if (!podeMoverCard(ator, (atual.responsavel_id as string | null) ?? null)) return { ok: false, error: "forbidden" };

  const origem = entrada.origem ?? "manual";
  const { data, error } = await supabase.rpc("mover_oportunidade", {
    p_clinica: clinicaId,
    p_oportunidade: id,
    p_estagio: entrada.estagioId,
    p_versao_esperada: entrada.versaoEsperada,
    p_ator: ator.atendenteId,
    p_origem: origem,
    p_motivo_perda: entrada.motivoPerdaId ?? null,
    p_observacao: entrada.observacao?.trim().slice(0, 500) || null,
    p_idem_key: entrada.idempotencyKey?.slice(0, 100) || null,
  });
  const r = data as RespostaRpc | null;
  if (error || !r) return { ok: false, error: "rpc_failed" };
  if (!r.ok) {
    return { ok: false, error: (r.error as ErroKanban) ?? "rpc_failed", versaoAtual: r.versao_atual as number | undefined, estagioAtual: r.estagio_atual as string | undefined };
  }
  if (r.idempotente || r.sem_mudanca) {
    return { ok: true, versao: r.versao as number, estagioId: (r.estagio_id as string) ?? entrada.estagioId, status: (r.status as string) ?? "open", semMudanca: Boolean(r.sem_mudanca), idempotente: Boolean(r.idempotente) };
  }

  // Só DEPOIS de persistido: auditoria (quem fez) + evento interno (motor de automação).
  const tipoDestino = r.status as TipoEstagio;
  await registrarEvento({
    clinicaId,
    atorId: ator.atendenteId,
    atorPerfil: ator.perfil,
    evento: eventoAuditoriaMovimento(tipoDestino),
    alvoId: id,
    detalhes: { de: r.estagio_de, para: r.estagio_id, origem },
  });
  await emitirEstagioAlterado(clinicaId, id, r, ator.atendenteId, origem);
  // Alertas: mudou de etapa → "oportunidade parada" da etapa anterior deixa de valer (a nova etapa começa o relógio do zero).
  await resolverPorEvento(clinicaId, { tipos: ["oportunidade_parada"], tipoEntidade: "oportunidade", entidadeId: id, evento: "oportunidade_movida", atorId: ator.atendenteId });

  return { ok: true, versao: r.versao as number, estagioId: r.estagio_id as string, status: r.status as string };
}

async function emitirEstagioAlterado(clinicaId: string, oportunidadeId: string, r: RespostaRpc, atorId: string | null, origem: OrigemMudanca): Promise<void> {
  try {
    const payload = montarPayloadEstagioAlterado({
      clinicaId,
      oportunidadeId,
      pacienteId: r.paciente_id as string,
      pipelineId: r.pipeline_id as string,
      estagioDe: (r.estagio_de as string | null) ?? null,
      estagioPara: r.estagio_id as string,
      atorId,
      ocorreuEm: new Date(),
      origem,
    });
    // referenciaId = id da linha de histórico: mesma mudança nunca emite 2x (dedupe do motor).
    await emitirEventoAutomacao({ clinicaId, pacienteId: payload.paciente_id, tipo: EVENTO_KANBAN_ESTAGIO, referenciaId: r.historico_id as string, metadata: payload });
  } catch (e) {
    console.error("[kanban] evento_failed", JSON.stringify({ message: (e as Error).message }));
  }
}

/** Ações explícitas: "Perdido"/"Convertido" resolvem o estágio pelo TIPO (won/lost) do pipeline da oportunidade. */
export async function moverParaTipo(
  clinicaId: string,
  ator: AtorConversa,
  id: string,
  tipo: "won" | "lost",
  entrada: Omit<EntradaMover, "estagioId">
): Promise<ResultadoMover> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };
  const { data: opp } = await supabase.from("oportunidades").select("pipeline_id").eq("id", id).eq("clinica_id", clinicaId).maybeSingle();
  if (!opp) return { ok: false, error: "not_found" };
  const { data: est } = await supabase
    .from("pipeline_estagios")
    .select("id")
    .eq("clinica_id", clinicaId)
    .eq("pipeline_id", opp.pipeline_id as string)
    .eq("tipo", tipo)
    .eq("ativo", true)
    .order("ordem")
    .limit(1)
    .maybeSingle();
  if (!est) return { ok: false, error: "estagio_invalido" };
  return moverOportunidade(clinicaId, ator, id, { ...entrada, estagioId: est.id as string });
}

// ---------------------------------------------------------------------------
// Editar (interesse) e responsável
// ---------------------------------------------------------------------------

export async function atualizarInteresse(clinicaId: string, ator: AtorConversa, id: string, interesse: string | null): Promise<{ ok: boolean; error?: ErroKanban }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };
  const { data: atual } = await supabase.from("oportunidades").select("responsavel_id").eq("id", id).eq("clinica_id", clinicaId).maybeSingle();
  if (!atual) return { ok: false, error: "not_found" };
  if (!podeMoverCard(ator, (atual.responsavel_id as string | null) ?? null)) return { ok: false, error: "forbidden" };
  const { error } = await supabase
    .from("oportunidades")
    .update({ interesse: interesse?.trim().slice(0, 120) || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinica_id", clinicaId);
  return error ? { ok: false, error: "rpc_failed" } : { ok: true };
}

export async function definirResponsavel(
  clinicaId: string,
  ator: AtorConversa,
  id: string,
  esperadoId: string | null,
  novoId: string | null
): Promise<{ ok: boolean; error?: ErroKanban }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };
  const { data: atual } = await supabase.from("oportunidades").select("responsavel_id").eq("id", id).eq("clinica_id", clinicaId).maybeSingle();
  if (!atual) return { ok: false, error: "not_found" };
  if (!podeMoverCard(ator, (atual.responsavel_id as string | null) ?? null)) return { ok: false, error: "forbidden" };

  if (novoId) {
    const destino = await buscarAtendenteCompletoPorId(novoId);
    if (!destino) return { ok: false, error: "responsavel_invalido" };
    const elegivel = destinoElegivel(
      { clinicaId: destino.clinicaId, status: destino.status, perfil: destino.perfil, permissoes: resolverPermissoes(destino.perfil, destino.permissoesCustomizadas) },
      clinicaId
    );
    if (elegivel !== true) return { ok: false, error: "responsavel_invalido" };
  }

  const { data, error } = await supabase.rpc("definir_responsavel_oportunidade", {
    p_clinica: clinicaId,
    p_oportunidade: id,
    p_esperado: esperadoId,
    p_novo: novoId,
    p_ator: ator.atendenteId,
    p_origem: "manual",
  });
  const r = data as RespostaRpc | null;
  if (error || !r) return { ok: false, error: "rpc_failed" };
  if (!r.ok) return { ok: false, error: (r.error as ErroKanban) ?? "rpc_failed" };
  if (!r.sem_mudanca) {
    await registrarEvento({ clinicaId, atorId: ator.atendenteId, atorPerfil: ator.perfil, evento: "OPPORTUNITY_OWNER_CHANGED", alvoId: id, detalhes: { de: esperadoId, para: novoId } });
  }
  return { ok: true };
}

/**
 * Responsável da oportunidade ACOMPANHA a conversa, sem acoplamento duro:
 * assumir (de=null) só preenche oportunidade sem responsável; transferir
 * (de=anterior) só leva junto a que era do responsável anterior. Devolver à
 * fila NÃO limpa o responsável comercial. Best-effort.
 */
export async function sincronizarResponsavelDaConversa(clinicaId: string, conversaId: string, de: string | null, para: string, atorId: string | null): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return;
    const { data, error } = await supabase.rpc("sincronizar_responsavel_oportunidade", {
      p_clinica: clinicaId,
      p_conversa: conversaId,
      p_de: de,
      p_para: para,
      p_ator: atorId,
      p_origem: "sistema",
    });
    if (error) console.error("[kanban] sync_responsavel_failed", JSON.stringify({ code: (error as { code?: string }).code ?? null }));
    else if (typeof data === "number" && data > 0) {
      await registrarEvento({ clinicaId, atorId, evento: "OPPORTUNITY_OWNER_CHANGED", alvoId: conversaId, detalhes: { via: "conversa", de, para, oportunidades: data } });
    }
  } catch (e) {
    console.error("[kanban] sync_responsavel_error", JSON.stringify({ message: (e as Error).message }));
  }
}
