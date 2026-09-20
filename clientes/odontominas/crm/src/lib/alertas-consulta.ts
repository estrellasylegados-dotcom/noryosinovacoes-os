import { getSupabaseServerClient } from "@/lib/supabase";
import { mapearAlerta, type AlertaLinha } from "@/lib/alertas";
import { carregarContextoSla, minutosEntre } from "@/lib/sla";
import { formatTelefone } from "@/lib/tempo";
import {
  destinoDoAlerta,
  definicaoDoTipo,
  escopoEquipe,
  isSeveridade,
  rankSeveridade,
  severidadeRelevante,
  STATUS_ATIVOS,
  STATUS_ENCERRADOS,
  tiposVisiveis,
  type AtorAlerta,
  type DestinoAlerta,
  type Natureza,
  type Severidade,
  type StatusAlerta,
} from "@/lib/alertas-tipos";

/**
 * Leitura da Central: listagem filtrada, busca, contexto e resumo do sino.
 * Visibilidade é decidida NO SQL (mesma regra de `podeVerAlerta`), nunca só na
 * tela. Contexto (paciente, canal, responsável) vem em UMA consulta por tipo de
 * entidade pra página inteira — nunca uma consulta por alerta.
 */

export type FiltrosAlertas = {
  situacao?: "ativos" | "resolvidos";
  severidade?: Severidade;
  categoria?: string;
  /** id do atendente, ou "sem" (sem responsável). */
  responsavel?: string;
  natureza?: Natureza;
  /** Só resolvidos (status "resolvido") com resolvido_em a partir daqui — o mesmo recorte do contador "Resolvidos hoje". */
  resolvidoDesde?: string;
  de?: string;
  ate?: string;
  busca?: string;
  pagina?: number;
};

export const POR_PAGINA = 30;
const TETO_CONSULTA = 300;

export type AlertaView = {
  id: string;
  tipo: string;
  categoria: string;
  natureza: Natureza;
  severidade: Severidade;
  status: StatusAlerta;
  titulo: string;
  descricao: string | null;
  detectadoEm: string;
  visualizadoEm: string | null;
  assumidoEm: string | null;
  assumidoPorNome: string | null;
  resolvidoEm: string | null;
  resolvidoPorEvento: string | null;
  resolvidoPorNome: string | null;
  ignoradoEm: string | null;
  ignoradoMotivo: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  pacienteNome: string | null;
  telefone: string | null;
  canalNome: string | null;
  contextoExtra: string | null;
  /** SLA: minutos além do limite AGORA (calculado com o mesmo cálculo de minutos úteis do SLA). */
  slaAlemDoLimiteMinutos: number | null;
  destino: DestinoAlerta | null;
  /** Ação rápida desta linha (mesmo destino, rótulo do contexto). */
  podeAssumir: boolean;
};

/** Escapa o que quebraria a sintaxe de filtro do PostgREST (vírgula, parênteses, curingas). */
export function limparTermoBusca(termo: string): string {
  // Colchetes fazem parte de muitos nomes de fixture (`[TESTE UI]`), mas o
  // PostgREST não os trata como texto literal dentro do filtro `ilike`.
  // Removê-los preserva as palavras pesquisadas e faz a busca pelo título
  // se comportar como o rótulo visível promete.
  return termo.replace(/[\[\],()%*\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

/** Expressão `.or()` da visibilidade, ou null quando `.in("tipo", …)` basta (visão de equipe). */
export function montarFiltroVisibilidade(ator: AtorAlerta): { tipos: string[]; expressaoOr: string | null } {
  const tipos = tiposVisiveis(ator);
  if (tipos.length === 0 || escopoEquipe(ator)) return { tipos, expressaoOr: null };
  const porResp = tipos.filter((t) => definicaoDoTipo(t)?.porResponsavel);
  const livres = tipos.filter((t) => !definicaoDoTipo(t)?.porResponsavel);
  const partes: string[] = [];
  if (livres.length) partes.push(`tipo.in.(${livres.join(",")})`);
  if (porResp.length) partes.push(`and(tipo.in.(${porResp.join(",")}),or(responsavel_id.is.null,responsavel_id.eq.${ator.atendenteId}))`);
  return { tipos, expressaoOr: partes.join(",") };
}

type Cliente = NonNullable<ReturnType<typeof getSupabaseServerClient>>;

/** Base de toda leitura: clínica + visibilidade. Sem tipo visível → null (nada a ler). */
function baseVisivel(supabase: Cliente, clinicaId: string, ator: AtorAlerta, select: string, opcoes?: { head?: boolean }) {
  const v = montarFiltroVisibilidade(ator);
  if (v.tipos.length === 0) return null;
  let q = supabase.from("alertas").select(select, opcoes?.head ? { count: "exact", head: true } : undefined).eq("clinica_id", clinicaId);
  q = v.expressaoOr ? q.or(v.expressaoOr) : q.in("tipo", v.tipos);
  return q;
}

async function idsPorBusca(supabase: Cliente, clinicaId: string, termoBruto: string): Promise<string[]> {
  const termo = limparTermoBusca(termoBruto);
  if (!termo) return [];
  const digitos = termo.replace(/\D/g, "");
  const filtroPaciente = digitos.length >= 4 ? `nome.ilike.%${termo}%,telefone.ilike.%${digitos}%` : `nome.ilike.%${termo}%`;

  const [{ data: pacientes }, { data: canais }] = await Promise.all([
    supabase.from("pacientes").select("id").eq("clinica_id", clinicaId).or(filtroPaciente).limit(50),
    supabase.from("canais").select("id").eq("clinica_id", clinicaId).ilike("nome", `%${termo}%`).limit(20),
  ]);
  const pacIds = (pacientes ?? []).map((p) => p.id as string);
  const filtroConversa = [digitos.length >= 4 ? `telefone.ilike.%${digitos}%` : null, pacIds.length ? `paciente_id.in.(${pacIds.join(",")})` : null].filter(Boolean).join(",");

  const [conversas, oportunidades] = await Promise.all([
    filtroConversa ? supabase.from("conversas").select("id").eq("clinica_id", clinicaId).or(filtroConversa).limit(100) : Promise.resolve({ data: [] as { id: string }[] }),
    pacIds.length ? supabase.from("oportunidades").select("id").eq("clinica_id", clinicaId).in("paciente_id", pacIds).limit(100) : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  return [...(conversas.data ?? []), ...(oportunidades.data ?? []), ...(canais ?? [])].map((r) => r.id as string);
}

function nomeEmbutido(v: unknown): string | null {
  const o = Array.isArray(v) ? v[0] : v;
  return (o as { nome?: string } | null | undefined)?.nome ?? null;
}

async function enriquecer(supabase: Cliente, clinicaId: string, alertas: AlertaLinha[], ator: AtorAlerta): Promise<AlertaView[]> {
  const idsDe = (tipoEntidade: string) => [...new Set(alertas.filter((a) => a.tipoEntidade === tipoEntidade && a.entidadeId).map((a) => a.entidadeId as string))];
  const conversaIds = [...new Set([...idsDe("conversa"), ...alertas.map((a) => (typeof a.dados.conversaId === "string" ? a.dados.conversaId : null)).filter((x): x is string => x !== null)])];
  const oportunidadeIds = idsDe("oportunidade");
  const canalIdsDiretos = idsDe("canal");
  const atendenteIds = [...new Set(alertas.flatMap((a) => [a.responsavelId, a.assumidoPor, a.resolvidoPor]).filter((x): x is string => x !== null))];
  const temSla = alertas.some((a) => a.tipo === "sla_limite");

  const vazio = { data: [] as Record<string, unknown>[] };
  const [conversas, oportunidades, canaisDiretos, atendentes, slaCtx] = await Promise.all([
    conversaIds.length ? supabase.from("conversas").select("id, telefone, canal_id, pacientes(nome), canais(nome)").eq("clinica_id", clinicaId).in("id", conversaIds) : Promise.resolve(vazio),
    oportunidadeIds.length ? supabase.from("oportunidades").select("id, pacientes(nome), pipeline_estagios(nome)").eq("clinica_id", clinicaId).in("id", oportunidadeIds) : Promise.resolve(vazio),
    canalIdsDiretos.length ? supabase.from("canais").select("id, nome, telefone").eq("clinica_id", clinicaId).in("id", canalIdsDiretos) : Promise.resolve(vazio),
    atendenteIds.length ? supabase.from("atendentes").select("id, nome").in("id", atendenteIds) : Promise.resolve(vazio),
    temSla ? carregarContextoSla(clinicaId) : Promise.resolve(null),
  ]);

  const mapa = <T extends Record<string, unknown>>(rows: T[] | null) => new Map((rows ?? []).map((r) => [r.id as string, r]));
  const conv = mapa(conversas.data as Record<string, unknown>[] | null);
  const opp = mapa(oportunidades.data as Record<string, unknown>[] | null);
  const can = mapa(canaisDiretos.data as Record<string, unknown>[] | null);
  const atd = new Map((atendentes.data ?? []).map((a) => [a.id as string, a.nome as string]));
  const agora = new Date();

  return alertas.map((a): AlertaView => {
    const conversaId = a.tipoEntidade === "conversa" ? a.entidadeId : typeof a.dados.conversaId === "string" ? a.dados.conversaId : null;
    const c = conversaId ? conv.get(conversaId) : undefined;
    const o = a.tipoEntidade === "oportunidade" && a.entidadeId ? opp.get(a.entidadeId) : undefined;
    const k = a.tipoEntidade === "canal" && a.entidadeId ? can.get(a.entidadeId) : undefined;

    let slaAlem: number | null = null;
    if (a.tipo === "sla_limite" && slaCtx && typeof a.dados.cicloInicioEm === "string" && typeof a.dados.limiteMinutos === "number") {
      const horario = slaCtx.config.considerarApenasHorarioUtil ? slaCtx.horario : null;
      slaAlem = minutosEntre(new Date(a.dados.cicloInicioEm), agora, horario, slaCtx.config.considerarApenasHorarioUtil) - (a.dados.limiteMinutos as number);
    }

    const telefoneBruto = (c?.telefone as string | undefined) ?? (k?.telefone as string | null | undefined) ?? null;
    return {
      id: a.id,
      tipo: a.tipo,
      categoria: a.categoria,
      natureza: a.natureza,
      severidade: a.severidade,
      status: a.status,
      titulo: a.titulo,
      descricao: a.descricao,
      detectadoEm: a.detectadoEm,
      visualizadoEm: a.visualizadoEm,
      assumidoEm: a.assumidoEm,
      assumidoPorNome: a.assumidoPor ? (atd.get(a.assumidoPor) ?? null) : null,
      resolvidoEm: a.resolvidoEm,
      resolvidoPorEvento: a.resolvidoPorEvento,
      resolvidoPorNome: a.resolvidoPor ? (atd.get(a.resolvidoPor) ?? null) : null,
      ignoradoEm: a.ignoradoEm,
      ignoradoMotivo: a.ignoradoMotivo,
      responsavelId: a.responsavelId,
      responsavelNome: a.responsavelId ? (atd.get(a.responsavelId) ?? null) : null,
      pacienteNome: nomeEmbutido(c?.pacientes) ?? nomeEmbutido(o?.pacientes),
      telefone: telefoneBruto ? formatTelefone(telefoneBruto) : null,
      canalNome: nomeEmbutido(c?.canais) ?? (k?.nome as string | undefined) ?? null,
      contextoExtra: nomeEmbutido(o?.pipeline_estagios) ?? (typeof a.dados.nome === "string" ? (a.dados.nome as string) : null),
      slaAlemDoLimiteMinutos: slaAlem,
      destino: destinoDoAlerta({ tipoEntidade: a.tipoEntidade, entidadeId: a.entidadeId, dados: a.dados }),
      podeAssumir: a.status === "aberto" && ator.permissoes.has("alertas.assumir"),
    };
  });
}

/** Críticos primeiro; dentro da severidade, os mais antigos primeiro (quem espera há mais tempo). */
export function ordenarPorPrioridade<T extends { severidade: Severidade; detectadoEm: string }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => rankSeveridade(b.severidade) - rankSeveridade(a.severidade) || new Date(a.detectadoEm).getTime() - new Date(b.detectadoEm).getTime());
}

export async function listarAlertas(clinicaId: string, ator: AtorAlerta, f: FiltrosAlertas = {}): Promise<{ alertas: AlertaView[]; total: number; pagina: number; porPagina: number }> {
  const vazio = { alertas: [], total: 0, pagina: 1, porPagina: POR_PAGINA };
  const supabase = getSupabaseServerClient();
  if (!supabase) return vazio;

  const situacao = f.situacao ?? "ativos";
  let q = baseVisivel(supabase, clinicaId, ator, "*");
  if (!q) return vazio;

  if (f.resolvidoDesde && situacao === "resolvidos") q = q.eq("status", "resolvido").gte("resolvido_em", f.resolvidoDesde);
  else q = q.in("status", [...(situacao === "ativos" ? STATUS_ATIVOS : STATUS_ENCERRADOS)]);
  if (f.severidade && isSeveridade(f.severidade)) q = q.eq("severidade", f.severidade);
  if (f.categoria) q = q.eq("categoria", f.categoria);
  if (f.natureza) q = q.eq("natureza", f.natureza);
  if (f.responsavel === "sem") q = q.is("responsavel_id", null);
  else if (f.responsavel) q = q.eq("responsavel_id", f.responsavel);
  if (f.de) q = q.gte("detectado_em", f.de);
  if (f.ate) q = q.lte("detectado_em", f.ate);
  if (f.busca) {
    const termo = limparTermoBusca(f.busca);
    if (termo) {
      const ids = await idsPorBusca(supabase, clinicaId, termo);
      q = q.or(ids.length ? `titulo.ilike.%${termo}%,entidade_id.in.(${ids.join(",")})` : `titulo.ilike.%${termo}%`);
    }
  }

  const { data, error } = await q.order(situacao === "ativos" ? "detectado_em" : "updated_at", { ascending: situacao === "ativos" }).limit(TETO_CONSULTA);
  if (error) {
    console.error("[alertas] listar_failed", JSON.stringify({ code: error.code ?? null }));
    return vazio;
  }

  const linhas = ((data ?? []) as unknown as Record<string, unknown>[]).map(mapearAlerta);
  // A fila ativa é pequena por desenho; ordenar por severidade em JS evita coluna redundante (texto ordena "atencao" < "critico").
  const ordenadas = situacao === "ativos" ? ordenarPorPrioridade(linhas) : linhas;
  const pagina = Math.max(1, Math.floor(f.pagina ?? 1));
  const fatia = ordenadas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return { alertas: await enriquecer(supabase, clinicaId, fatia, ator), total: ordenadas.length, pagina, porPagina: POR_PAGINA };
}

export async function buscarAlertaVisivel(clinicaId: string, ator: AtorAlerta, alertaId: string): Promise<AlertaView | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const q = baseVisivel(supabase, clinicaId, ator, "*");
  if (!q) return null;
  const { data } = await q.eq("id", alertaId).maybeSingle();
  if (!data) return null;
  const [view] = await enriquecer(supabase, clinicaId, [mapearAlerta(data as unknown as Record<string, unknown>)], ator);
  return view ?? null;
}

// ---------------------------------------------------------------------------
// Resumo (cabeçalho / sino / futura Central de Operações)
// ---------------------------------------------------------------------------

export type ResumoAlertas = {
  criticos: number;
  atencao: number;
  informativos: number;
  /** critico + atencao: o número do sino. Informativo só aparece na Central. */
  relevantes: number;
  resolvidosHoje: number;
  ultimaVerificacaoEm: string | null;
  ultimos: AlertaView[];
};

const RESUMO_VAZIO: ResumoAlertas = { criticos: 0, atencao: 0, informativos: 0, relevantes: 0, resolvidosHoje: 0, ultimaVerificacaoEm: null, ultimos: [] };
const ULTIMOS_NO_SINO = 5;

/** "Hoje" no fuso da clínica (Brasil sem horário de verão: UTC-3 fixo). */
export function inicioDoDiaBrasilia(agora: Date): Date {
  const local = new Date(agora.getTime() - 3 * 3600_000);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + 3 * 3600_000);
}

export async function resumirAlertas(clinicaId: string, ator: AtorAlerta): Promise<ResumoAlertas> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return RESUMO_VAZIO;
  if (!baseVisivel(supabase, clinicaId, ator, "id", { head: true })) return RESUMO_VAZIO;

  const contar = async (sev: Severidade): Promise<number> => {
    const q = baseVisivel(supabase, clinicaId, ator, "id", { head: true });
    const { count } = q ? await q.in("status", [...STATUS_ATIVOS]).eq("severidade", sev) : { count: 0 };
    return count ?? 0;
  };
  const resolvidosHoje = async (): Promise<number> => {
    const q = baseVisivel(supabase, clinicaId, ator, "id", { head: true });
    const { count } = q ? await q.eq("status", "resolvido").gte("resolvido_em", inicioDoDiaBrasilia(new Date()).toISOString()) : { count: 0 };
    return count ?? 0;
  };

  const [criticos, atencao, informativos, hoje, ultimosBrutos, cfg] = await Promise.all([
    contar("critico"),
    contar("atencao"),
    contar("informativo"),
    resolvidosHoje(),
    (async () => {
      const q = baseVisivel(supabase, clinicaId, ator, "*");
      if (!q) return [] as AlertaLinha[];
      const { data } = await q.in("status", [...STATUS_ATIVOS]).in("severidade", ["critico", "atencao"]).order("detectado_em", { ascending: true }).limit(40);
      return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapearAlerta);
    })(),
    supabase.from("alertas_config").select("ultima_verificacao_em").eq("clinica_id", clinicaId).maybeSingle(),
  ]);

  const top = ordenarPorPrioridade(ultimosBrutos.filter((a) => severidadeRelevante(a.severidade))).slice(0, ULTIMOS_NO_SINO);
  return {
    criticos,
    atencao,
    informativos,
    relevantes: criticos + atencao,
    resolvidosHoje: hoje,
    ultimaVerificacaoEm: (cfg.data?.ultima_verificacao_em as string | null) ?? null,
    ultimos: await enriquecer(supabase, clinicaId, top, ator),
  };
}
