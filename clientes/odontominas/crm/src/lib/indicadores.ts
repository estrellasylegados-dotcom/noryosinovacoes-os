import { buscarConfigAlertas } from "@/lib/alertas-config";
import { buscarConfiguracaoHorario, type ConfiguracaoHorario } from "@/lib/horario-atendimento";
import { buscarStatusSlaLista, buscarSlaConfig, minutosEntre, type StatusSlaConversa } from "@/lib/sla";
import { getSupabaseServerClient } from "@/lib/supabase";

type Linha = Record<string, unknown>;

export type FiltrosIndicadores = {
  inicio: Date;
  fim: Date;
  responsavelId?: string;
  canalId?: string;
};

export type OpcaoIndicador = { id: string; nome: string };

export type IndicadoresDashboard = {
  periodo: { inicio: string; fim: string };
  kpis: {
    oportunidades: number;
    avancaram: number;
    abertas: number;
    agendadas: number;
    convertidas: number;
    perdidas: number;
    taxaFechamento: number | null;
  };
  tendencia: {
    categorias: string[];
    oportunidades: number[];
    convertidas: number[];
  };
  funil: {
    id: string;
    nome: string;
    tipo: "open" | "won" | "lost";
    cor: string | null;
    quantidade: number;
    paradas: number;
    limiteParadaMinutos: number | null;
  }[];
  atendimento: {
    conversasRecebidas: number;
    conversasAtendidas: number;
    semResponsavel: number;
    primeiraRespostaMediaMinutos: number | null;
    primeiraRespostaMedianaMinutos: number | null;
    amostrasPrimeiraResposta: number;
    primeiraRespostaModo: "horario_util" | "tempo_corrido";
    slaDisponivel: boolean;
    slaDentro: number;
    slaAtencao: number;
    slaEstourado: number;
    slaPausado: number;
    slaDentroPercentual: number | null;
  };
  canais: {
    id: string;
    nome: string;
    oportunidades: number;
    convertidas: number;
    taxaFechamento: number | null;
  }[];
  origem: {
    cobertura: number;
    total: number;
    linhas: { nome: string; oportunidades: number; convertidas: number }[];
  };
  equipe: {
    id: string;
    nome: string;
    perfil: string;
    oportunidades: number;
    abertas: number;
    conversasEmAtendimento: number;
    agendamentos: number;
    conversoes: number;
    primeiraRespostaMediaMinutos: number | null;
    slaEstourado: number;
  }[];
  qualidade: {
    oportunidadesDemonstracao: number;
    horarioConfigurado: boolean;
  };
  opcoes: { atendentes: OpcaoIndicador[]; canais: OpcaoIndicador[] };
};

export type DadosIndicadores = {
  oportunidades: Linha[];
  historico: Linha[];
  estagios: Linha[];
  pacientes: Linha[];
  conversas: Linha[];
  mensagens: Linha[];
  atendentes: Linha[];
  canais: Linha[];
  regrasKanban: { estagioId: string; limiteMinutos: number | null; ativo: boolean }[];
  slaAtual: { conversaId: string; atribuidoAId: string | null; status: StatusSlaConversa }[];
  slaAtivo: boolean;
  slaConsiderarHorarioUtil: boolean;
  horario: ConfiguracaoHorario | null;
  horarioConfigurado: boolean;
};

const dentro = (valor: unknown, inicio: number, fim: number) => {
  if (typeof valor !== "string") return false;
  const tempo = new Date(valor).getTime();
  return Number.isFinite(tempo) && tempo >= inicio && tempo <= fim;
};

const texto = (valor: unknown) => (typeof valor === "string" ? valor : null);

const mediana = (valores: number[]): number | null => {
  if (valores.length === 0) return null;
  const ordem = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordem.length / 2);
  return ordem.length % 2 ? ordem[meio] : (ordem[meio - 1] + ordem[meio]) / 2;
};

const ehDemonstracao = (nome: string | null) => /^\s*\[?(?:teste|demo)\]?/i.test(nome ?? "");

function montarTendencia(
  oportunidades: Linha[],
  inicio: number,
  fim: number
): IndicadoresDashboard["tendencia"] {
  const dia = 24 * 60 * 60 * 1000;
  const dias = Math.max(1, Math.ceil((fim - inicio + 1) / dia));
  const passo = dias > 31 ? 7 * dia : dia;
  const quantidade = Math.max(1, Math.ceil((fim - inicio + 1) / passo));
  const formatador = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  const categorias = Array.from({ length: quantidade }, (_, indice) => formatador.format(new Date(inicio + indice * passo)));
  const entradas = Array(quantidade).fill(0) as number[];
  const convertidas = Array(quantidade).fill(0) as number[];
  const somar = (valor: unknown, destino: number[]) => {
    if (typeof valor !== "string") return;
    const tempo = new Date(valor).getTime();
    if (!Number.isFinite(tempo) || tempo < inicio || tempo > fim) return;
    const indice = Math.min(quantidade - 1, Math.floor((tempo - inicio) / passo));
    destino[indice]++;
  };
  for (const oportunidade of oportunidades) {
    somar(oportunidade.created_at, entradas);
    somar(oportunidade.converted_at, convertidas);
  }
  return { categorias, oportunidades: entradas, convertidas };
}

function responsavelNoMomento(historico: Linha[], quando: string): string | null {
  let responsavel: string | null = null;
  const limite = new Date(quando).getTime();
  for (const evento of historico) {
    const criadoEm = texto(evento.created_at);
    if (!criadoEm || new Date(criadoEm).getTime() > limite) break;
    if (evento.tipo === "created" || evento.tipo === "owner_changed") {
      responsavel = texto(evento.responsavel_para);
    }
  }
  return responsavel;
}

function minutosPrimeiraResposta(
  conversaId: string,
  mensagens: Linha[],
  horario: ConfiguracaoHorario | null,
  usarHorarioUtil: boolean,
  inicioPeriodo: number,
  fimPeriodo: number
): { conversaId: string; minutos: number; atendenteId: string; inicioEm: string } | null {
  const daConversa = mensagens
    .filter((m) => m.conversa_id === conversaId)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const recebida = daConversa.find((m) => m.direcao === "recebida" && dentro(m.created_at, inicioPeriodo, fimPeriodo));
  const inicio = texto(recebida?.created_at);
  if (!inicio) return null;
  const resposta = daConversa.find(
    (m) => m.direcao === "enviada" && texto(m.enviada_por_atendente_id) && String(m.created_at) >= inicio
  );
  const fim = texto(resposta?.created_at);
  const atendenteId = texto(resposta?.enviada_por_atendente_id);
  if (!fim || !atendenteId) return null;
  return { conversaId, minutos: minutosEntre(new Date(inicio), new Date(fim), horario, usarHorarioUtil), atendenteId, inicioEm: inicio };
}

export function calcularIndicadores(dados: DadosIndicadores, filtros: FiltrosIndicadores, agora: Date = new Date()): IndicadoresDashboard {
  const inicio = filtros.inicio.getTime();
  const fim = filtros.fim.getTime();
  const pacientes = new Map(dados.pacientes.map((p) => [p.id as string, p]));
  const conversas = new Map(dados.conversas.map((c) => [c.id as string, c]));
  const estagios = new Map(dados.estagios.map((e) => [e.id as string, e]));
  const canais = new Map(dados.canais.map((c) => [c.id as string, c]));
  const historicoPorOportunidade = new Map<string, Linha[]>();
  for (const evento of dados.historico) {
    const id = evento.oportunidade_id as string;
    if (!historicoPorOportunidade.has(id)) historicoPorOportunidade.set(id, []);
    historicoPorOportunidade.get(id)!.push(evento);
  }
  for (const eventos of historicoPorOportunidade.values()) {
    eventos.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  }

  const combinaEscopo = (o: Linha) => {
    if (filtros.responsavelId && o.responsavel_id !== filtros.responsavelId) return false;
    const conversa = conversas.get(o.conversa_id as string);
    if (filtros.canalId && conversa?.canal_id !== filtros.canalId) return false;
    return true;
  };

  const oportunidadesEscopo = dados.oportunidades.filter(combinaEscopo);
  const coorte = oportunidadesEscopo.filter((o) => dentro(o.created_at, inicio, fim));
  const idsEscopo = new Set(oportunidadesEscopo.map((o) => o.id as string));
  const eventosPeriodo = dados.historico.filter(
    (h) => idsEscopo.has(h.oportunidade_id as string) && dentro(h.created_at, inicio, fim)
  );
  const avancaram = new Set(eventosPeriodo.filter((h) => h.tipo === "stage_changed").map((h) => h.oportunidade_id as string));
  const agendadasEventos = eventosPeriodo.filter((h) => estagios.get(h.estagio_para as string)?.nome === "Agendado");
  const agendadas = new Set(agendadasEventos.map((h) => h.oportunidade_id as string));
  const convertidas = oportunidadesEscopo.filter((o) => dentro(o.converted_at, inicio, fim));
  const perdidas = oportunidadesEscopo.filter((o) => dentro(o.lost_at, inicio, fim));
  const fechadas = convertidas.length + perdidas.length;
  const tendencia = montarTendencia(oportunidadesEscopo, inicio, fim);

  const regras = new Map(
    dados.regrasKanban.filter((r) => r.ativo && r.limiteMinutos !== null).map((r) => [r.estagioId, r.limiteMinutos as number])
  );
  const funil = [...dados.estagios]
    .filter((e) => e.ativo !== false)
    .sort((a, b) => Number(a.ordem) - Number(b.ordem))
    .map((e) => {
      const cards = coorte.filter((o) => o.estagio_id === e.id);
      const limite = regras.get(e.id as string) ?? null;
      const paradas = limite === null
        ? 0
        : cards.filter((o) => o.status === "open" && (agora.getTime() - new Date(String(o.estagio_entrou_em)).getTime()) / 60000 >= limite).length;
      return {
        id: e.id as string,
        nome: e.nome as string,
        tipo: e.tipo as "open" | "won" | "lost",
        cor: texto(e.cor),
        quantidade: cards.length,
        paradas,
        limiteParadaMinutos: limite,
      };
    });

  const conversasEscopo = dados.conversas.filter((c) => {
    if (filtros.responsavelId && c.atribuido_a !== filtros.responsavelId) return false;
    if (filtros.canalId && c.canal_id !== filtros.canalId) return false;
    return true;
  });
  const conversaIds = new Set(conversasEscopo.map((c) => c.id as string));
  const mensagensPeriodo = dados.mensagens.filter((m) => conversaIds.has(m.conversa_id as string) && dentro(m.created_at, inicio, fim));
  const recebidas = new Set(mensagensPeriodo.filter((m) => m.direcao === "recebida").map((m) => m.conversa_id as string));
  const usarHorarioUtil = dados.slaConsiderarHorarioUtil && dados.horarioConfigurado;
  const respostas = [...recebidas]
    .map((id) => minutosPrimeiraResposta(id, dados.mensagens, dados.horario, usarHorarioUtil, inicio, fim))
    .filter((r): r is { conversaId: string; minutos: number; atendenteId: string; inicioEm: string } => r !== null);
  const atendidas = new Set(respostas.map((resposta) => resposta.conversaId));
  const tempos = respostas.map((r) => r.minutos);

  const slaEscopo = dados.slaAtual.filter((item) => {
    const conversa = conversas.get(item.conversaId);
    if (!conversa) return false;
    if (filtros.responsavelId && item.atribuidoAId !== filtros.responsavelId) return false;
    if (filtros.canalId && conversa.canal_id !== filtros.canalId) return false;
    return true;
  });
  const slaDentro = slaEscopo.filter((x) => x.status.tipo === "ok").length;
  const slaAtencao = slaEscopo.filter((x) => x.status.tipo === "warning").length;
  const slaEstourado = slaEscopo.filter((x) => x.status.tipo === "breached").length;
  const slaPausado = slaEscopo.filter((x) => x.status.tipo === "paused").length;
  const totalSla = slaDentro + slaAtencao + slaEstourado;

  const canaisLinhas = [...canais.values()]
    .filter((c) => c.ativo !== false && (!filtros.canalId || c.id === filtros.canalId))
    .map((canal) => {
      const doCanal = coorte.filter((o) => conversas.get(o.conversa_id as string)?.canal_id === canal.id);
      const ganhos = doCanal.filter((o) => o.status === "won").length;
      const perdas = doCanal.filter((o) => o.status === "lost").length;
      return {
        id: canal.id as string,
        nome: canal.nome as string,
        oportunidades: doCanal.length,
        convertidas: ganhos,
        taxaFechamento: ganhos + perdas > 0 ? Math.round((ganhos / (ganhos + perdas)) * 100) : null,
      };
    })
    .filter((c) => c.oportunidades > 0 || Boolean(filtros.canalId))
    .sort((a, b) => b.oportunidades - a.oportunidades);

  const origens = new Map<string, { oportunidades: number; convertidas: number }>();
  let coberturaOrigem = 0;
  for (const o of coorte) {
    const paciente = pacientes.get(o.paciente_id as string);
    const origem = texto(paciente?.origem_lead) ?? texto(paciente?.utm_source);
    if (!origem) continue;
    coberturaOrigem++;
    const atual = origens.get(origem) ?? { oportunidades: 0, convertidas: 0 };
    atual.oportunidades++;
    if (o.status === "won") atual.convertidas++;
    origens.set(origem, atual);
  }

  const equipe = dados.atendentes
    .filter((a) => a.status === "active" && ["dona", "gerente", "supervisora", "atendente"].includes(String(a.perfil)))
    .filter((a) => !filtros.responsavelId || a.id === filtros.responsavelId)
    .map((a) => {
      const id = a.id as string;
      const doAtendente = coorte.filter((o) => o.responsavel_id === id);
      const agendamentos = new Set(agendadasEventos.filter((evento) => responsavelNoMomento(historicoPorOportunidade.get(evento.oportunidade_id as string) ?? [], String(evento.created_at)) === id).map((evento) => evento.oportunidade_id as string)).size;
      const conversoes = new Set(eventosPeriodo.filter((evento) => {
        const estagio = estagios.get(evento.estagio_para as string);
        return estagio?.tipo === "won" && responsavelNoMomento(historicoPorOportunidade.get(evento.oportunidade_id as string) ?? [], String(evento.created_at)) === id;
      }).map((evento) => evento.oportunidade_id as string)).size;
      const respostasDaPessoa = respostas.filter((r) => r.atendenteId === id).map((r) => r.minutos);
      return {
        id,
        nome: a.nome as string,
        perfil: a.perfil as string,
        oportunidades: doAtendente.length,
        abertas: doAtendente.filter((o) => o.status === "open").length,
        conversasEmAtendimento: dados.conversas.filter((c) => c.atribuido_a === id && !c.finalizada_em && c.arquivada !== true).length,
        agendamentos,
        conversoes,
        primeiraRespostaMediaMinutos: respostasDaPessoa.length
          ? Math.round(respostasDaPessoa.reduce((soma, valor) => soma + valor, 0) / respostasDaPessoa.length)
          : null,
        slaEstourado: dados.slaAtual.filter((x) => x.atribuidoAId === id && x.status.tipo === "breached").length,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    periodo: { inicio: filtros.inicio.toISOString(), fim: filtros.fim.toISOString() },
    kpis: {
      oportunidades: coorte.length,
      avancaram: avancaram.size,
      abertas: coorte.filter((o) => o.status === "open").length,
      agendadas: agendadas.size,
      convertidas: convertidas.length,
      perdidas: perdidas.length,
      taxaFechamento: fechadas > 0 ? Math.round((convertidas.length / fechadas) * 100) : null,
    },
    tendencia,
    funil,
    atendimento: {
      conversasRecebidas: recebidas.size,
      conversasAtendidas: atendidas.size,
      semResponsavel: conversasEscopo.filter((c) => !c.atribuido_a && !c.finalizada_em && c.arquivada !== true).length,
      primeiraRespostaMediaMinutos: tempos.length ? Math.round(tempos.reduce((soma, valor) => soma + valor, 0) / tempos.length) : null,
      primeiraRespostaMedianaMinutos: mediana(tempos),
      amostrasPrimeiraResposta: tempos.length,
      primeiraRespostaModo: usarHorarioUtil ? "horario_util" : "tempo_corrido",
      slaDisponivel: dados.slaAtivo && (!dados.slaConsiderarHorarioUtil || dados.horarioConfigurado),
      slaDentro,
      slaAtencao,
      slaEstourado,
      slaPausado,
      slaDentroPercentual: totalSla > 0 ? Math.round((slaDentro / totalSla) * 100) : null,
    },
    canais: canaisLinhas,
    origem: {
      cobertura: coberturaOrigem,
      total: coorte.length,
      linhas: [...origens.entries()]
        .map(([nome, valor]) => ({ nome, ...valor }))
        .sort((a, b) => b.oportunidades - a.oportunidades),
    },
    equipe,
    qualidade: {
      oportunidadesDemonstracao: coorte.filter((o) => ehDemonstracao(texto(pacientes.get(o.paciente_id as string)?.nome))).length,
      horarioConfigurado: dados.horarioConfigurado,
    },
    opcoes: {
      atendentes: dados.atendentes
        .filter((a) => a.status === "active" && ["dona", "gerente", "supervisora", "atendente"].includes(String(a.perfil)))
        .map((a) => ({ id: a.id as string, nome: a.nome as string }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      canais: dados.canais
        .filter((c) => c.ativo !== false)
        .map((c) => ({ id: c.id as string, nome: c.nome as string }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    },
  };
}

type ResultadoPagina<T> = { data: T[] | null; error: { code?: string; message?: string } | null };

async function paginar<T>(buscar: (inicio: number, fim: number) => PromiseLike<ResultadoPagina<T>>): Promise<T[]> {
  const tamanho = 1000;
  const resultado: T[] = [];
  for (let inicio = 0; ; inicio += tamanho) {
    const pagina = await buscar(inicio, inicio + tamanho - 1);
    if (pagina.error) throw new Error(pagina.error.code ?? pagina.error.message ?? "consulta_indicadores_falhou");
    const linhas = pagina.data ?? [];
    resultado.push(...linhas);
    if (linhas.length < tamanho) return resultado;
  }
}

export async function buscarIndicadores(clinicaId: string, filtros: FiltrosIndicadores, agora: Date = new Date()): Promise<IndicadoresDashboard | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  try {
    const [oportunidades, historico, estagios, pacientes, conversas, mensagens, atendentes, canais, alertasConfig, slaConfig, horario, slaAtual] = await Promise.all([
      paginar<Linha>((de, ate) => supabase.from("oportunidades").select("id, paciente_id, estagio_id, responsavel_id, conversa_id, status, estagio_entrou_em, converted_at, lost_at, created_at").eq("clinica_id", clinicaId).order("created_at").range(de, ate) as unknown as PromiseLike<ResultadoPagina<Linha>>),
      paginar<Linha>((de, ate) => supabase.from("oportunidade_historico").select("id, oportunidade_id, tipo, estagio_de, estagio_para, responsavel_de, responsavel_para, created_at").eq("clinica_id", clinicaId).order("created_at").range(de, ate) as unknown as PromiseLike<ResultadoPagina<Linha>>),
      paginar<Linha>((de, ate) => supabase.from("pipeline_estagios").select("id, nome, ordem, tipo, cor, ativo").eq("clinica_id", clinicaId).order("ordem").range(de, ate) as unknown as PromiseLike<ResultadoPagina<Linha>>),
      paginar<Linha>((de, ate) => supabase.from("pacientes").select("id, nome, origem_lead, utm_source, campanha_id").eq("clinica_id", clinicaId).order("created_at").range(de, ate) as unknown as PromiseLike<ResultadoPagina<Linha>>),
      paginar<Linha>((de, ate) => supabase.from("conversas").select("id, paciente_id, atribuido_a, canal_id, status, finalizada_em, arquivada, created_at").eq("clinica_id", clinicaId).order("created_at").range(de, ate) as unknown as PromiseLike<ResultadoPagina<Linha>>),
      paginar<Linha>((de, ate) => supabase.from("mensagens").select("id, conversa_id, direcao, enviada_por_atendente_id, created_at").eq("clinica_id", clinicaId).lte("created_at", filtros.fim.toISOString()).order("created_at").range(de, ate) as unknown as PromiseLike<ResultadoPagina<Linha>>),
      paginar<Linha>((de, ate) => supabase.from("atendentes").select("id, nome, perfil, status").eq("clinica_id", clinicaId).order("nome").range(de, ate) as unknown as PromiseLike<ResultadoPagina<Linha>>),
      paginar<Linha>((de, ate) => supabase.from("canais").select("id, nome, ativo").eq("clinica_id", clinicaId).order("nome").range(de, ate) as unknown as PromiseLike<ResultadoPagina<Linha>>),
      buscarConfigAlertas(clinicaId),
      buscarSlaConfig(clinicaId),
      buscarConfiguracaoHorario(clinicaId),
      buscarStatusSlaLista(clinicaId, agora),
    ]);

    const horarioConfigurado = Boolean(horario && horario.periodos.length > 0);
    return calcularIndicadores(
      {
        oportunidades,
        historico,
        estagios,
        pacientes,
        conversas,
        mensagens,
        atendentes,
        canais,
        regrasKanban: alertasConfig.kanbanRegras,
        slaAtual,
        slaAtivo: slaConfig.ativo,
        slaConsiderarHorarioUtil: slaConfig.considerarApenasHorarioUtil,
        horario,
        horarioConfigurado,
      },
      filtros,
      agora
    );
  } catch (error) {
    console.error("[indicadores] consulta_falhou", JSON.stringify({ message: error instanceof Error ? error.message : "erro_desconhecido" }));
    return null;
  }
}
