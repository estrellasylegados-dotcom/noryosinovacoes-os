import { getSupabaseServerClient } from "@/lib/supabase";
import { buscarCampanha, listarCampanhas, type Campanha } from "@/lib/campanhas";

/**
 * Métricas de Campanha — tudo calculado ao vivo (sem tabela de métricas),
 * mesmo padrão de src/lib/relatorios.ts. "Leads" e "respostas" vêm de
 * `pacientes`/`mensagens` (fonte primária, sempre existe); "qualificados/
 * agendamentos/comparecimentos/fechamentos/receita" vêm de
 * `campanha_eventos` (só existem quando o marco de fato aconteceu — nunca
 * inventa número).
 *
 * Item 16 do briefing: qualquer métrica financeira (CPL/CPA/CAC/ROAS) some
 * quando não há `investimento_real` registrado — não mostra "R$0,00" nem
 * "Infinity".
 */

export type PainelCampanha = {
  leads: number;
  respostas: number;
  qualificados: number;
  agendamentos: number;
  comparecimentos: number;
  fechamentos: number;
  receita: number;
  investimento: number | null;
  cpl: number | null;
  cpa: number | null;
  cac: number | null;
  roas: number | null;
  taxaResposta: number | null;
  taxaAgendamento: number | null;
  taxaComparecimento: number | null;
  taxaFechamento: number | null;
};

export type EntradaMetricas = {
  investimento: number | null;
  leads: number;
  respostas: number;
  qualificados: number;
  agendamentos: number;
  comparecimentos: number;
  fechamentos: number;
  receita: number;
};

function divisao(numerador: number, denominador: number): number | null {
  if (!denominador) return null;
  return numerador / denominador;
}

/** Núcleo puro (testável sem Supabase) — só faz conta em cima de contagens já resolvidas. */
export function calcularMetricas(e: EntradaMetricas): PainelCampanha {
  const temInvestimento = e.investimento !== null && e.investimento > 0;

  return {
    leads: e.leads,
    respostas: e.respostas,
    qualificados: e.qualificados,
    agendamentos: e.agendamentos,
    comparecimentos: e.comparecimentos,
    fechamentos: e.fechamentos,
    receita: e.receita,
    investimento: e.investimento,
    cpl: temInvestimento ? divisao(e.investimento as number, e.leads) : null,
    cpa: temInvestimento ? divisao(e.investimento as number, e.agendamentos) : null,
    cac: temInvestimento ? divisao(e.investimento as number, e.fechamentos) : null,
    roas: temInvestimento ? divisao(e.receita, e.investimento as number) : null,
    taxaResposta: divisao(e.respostas, e.leads),
    taxaAgendamento: divisao(e.agendamentos, e.leads),
    taxaComparecimento: divisao(e.comparecimentos, e.agendamentos),
    taxaFechamento: divisao(e.fechamentos, e.agendamentos),
  };
}

async function contarEventos(
  clinicaId: string,
  campanhaId: string,
  tipo: "qualified_lead" | "appointment_booked" | "appointment_attended" | "treatment_closed"
): Promise<{ total: number; receita: number }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { total: 0, receita: 0 };

  const { data } = await supabase
    .from("campanha_eventos")
    .select("valor")
    .eq("clinica_id", clinicaId)
    .eq("campanha_id", campanhaId)
    .eq("tipo", tipo);

  const linhas = data ?? [];
  const receita = linhas.reduce((soma, l) => soma + ((l.valor as number | null) ?? 0), 0);
  return { total: linhas.length, receita };
}

export async function calcularPainelCampanha(clinicaId: string, campanhaId: string): Promise<PainelCampanha | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const campanha = await buscarCampanha(clinicaId, campanhaId);
  if (!campanha) return null;

  const { data: pacientesDaCampanha } = await supabase
    .from("pacientes")
    .select("id")
    .eq("clinica_id", clinicaId)
    .eq("campanha_id", campanhaId);

  const idsPacientes = (pacientesDaCampanha ?? []).map((p) => p.id as string);
  const leads = idsPacientes.length;

  let respostas = 0;
  let idsConversas: string[] = [];
  if (idsPacientes.length > 0) {
    const { data: conversasDaCampanha } = await supabase
      .from("conversas")
      .select("id")
      .eq("clinica_id", clinicaId)
      .in("paciente_id", idsPacientes);
    idsConversas = (conversasDaCampanha ?? []).map((c) => c.id as string);
  }
  if (idsConversas.length > 0) {
    const { data: respondidas } = await supabase
      .from("mensagens")
      .select("conversa_id")
      .eq("direcao", "enviada")
      .in("conversa_id", idsConversas);
    respostas = new Set((respondidas ?? []).map((m) => m.conversa_id as string)).size;
  }

  const [qualificados, agendamentos, comparecimentos, fechamentos] = await Promise.all([
    contarEventos(clinicaId, campanhaId, "qualified_lead"),
    contarEventos(clinicaId, campanhaId, "appointment_booked"),
    contarEventos(clinicaId, campanhaId, "appointment_attended"),
    contarEventos(clinicaId, campanhaId, "treatment_closed"),
  ]);

  return calcularMetricas({
    investimento: campanha.investimentoReal,
    leads: leads ?? 0,
    respostas,
    qualificados: qualificados.total,
    agendamentos: agendamentos.total,
    comparecimentos: comparecimentos.total,
    fechamentos: fechamentos.total,
    receita: fechamentos.receita,
  });
}

export type PeriodoMetricas = { inicio: Date; fim: Date };

export type PainelGeralCampanhas = PainelCampanha & { campanhasAtivas: number };

/** Resumo do topo da tela `/campanhas` — agregado de todas as campanhas da clínica no período selecionado. */
export async function calcularPainelGeral(clinicaId: string, periodo: PeriodoMetricas): Promise<PainelGeralCampanhas> {
  const supabase = getSupabaseServerClient();
  const vazio: PainelGeralCampanhas = { ...calcularMetricas({ investimento: null, leads: 0, respostas: 0, qualificados: 0, agendamentos: 0, comparecimentos: 0, fechamentos: 0, receita: 0 }), campanhasAtivas: 0 };
  if (!supabase) return vazio;

  const inicioIso = periodo.inicio.toISOString();
  const fimIso = periodo.fim.toISOString();

  const todasCampanhas = await listarCampanhas(clinicaId);
  const campanhasAtivas = todasCampanhas.filter((c) => c.status === "ativa").length;
  const campanhasNoPeriodo = todasCampanhas.filter((c) => c.createdAt >= inicioIso && c.createdAt <= fimIso);
  const idsNoPeriodo = campanhasNoPeriodo.map((c) => c.id);
  const investimentoTotal = campanhasNoPeriodo.reduce((soma, c) => soma + (c.investimentoReal ?? 0), 0);
  const temInvestimento = campanhasNoPeriodo.some((c) => c.investimentoReal !== null);

  const { count: leads } = await supabase
    .from("pacientes")
    .select("id", { count: "exact", head: true })
    .eq("clinica_id", clinicaId)
    .not("campanha_id", "is", null)
    .gte("created_at", inicioIso)
    .lte("created_at", fimIso);

  const { data: eventos } =
    idsNoPeriodo.length > 0
      ? await supabase
          .from("campanha_eventos")
          .select("tipo, valor")
          .eq("clinica_id", clinicaId)
          .in("campanha_id", idsNoPeriodo)
          .gte("created_at", inicioIso)
          .lte("created_at", fimIso)
      : { data: [] };

  const linhas = eventos ?? [];
  const contarTipo = (tipo: string) => linhas.filter((l) => l.tipo === tipo).length;
  const receita = linhas.filter((l) => l.tipo === "treatment_closed").reduce((s, l) => s + ((l.valor as number | null) ?? 0), 0);

  const metricas = calcularMetricas({
    investimento: temInvestimento ? investimentoTotal : null,
    leads: leads ?? 0,
    respostas: 0,
    qualificados: contarTipo("qualified_lead"),
    agendamentos: contarTipo("appointment_booked"),
    comparecimentos: contarTipo("appointment_attended"),
    fechamentos: contarTipo("treatment_closed"),
    receita,
  });

  return { ...metricas, campanhasAtivas };
}

export type LinhaMarketing = {
  campanha: Campanha;
  leads: number;
  agendamentos: number;
  fechamentos: number;
  receita: number;
  investimento: number | null;
};

/** Relatórios → Marketing (item 24): 1 linha por campanha, pra tela filtrar/agrupar por canal, especialidade ou responsável. */
export async function montarRelatorioMarketing(clinicaId: string, periodo: PeriodoMetricas): Promise<LinhaMarketing[]> {
  const campanhas = await listarCampanhas(clinicaId);
  const inicioIso = periodo.inicio.toISOString();
  const fimIso = periodo.fim.toISOString();

  const linhas: LinhaMarketing[] = [];
  for (const campanha of campanhas) {
    const supabase = getSupabaseServerClient();
    if (!supabase) break;

    const { count: leads } = await supabase
      .from("pacientes")
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", clinicaId)
      .eq("campanha_id", campanha.id)
      .gte("created_at", inicioIso)
      .lte("created_at", fimIso);

    const { data: eventos } = await supabase
      .from("campanha_eventos")
      .select("tipo, valor")
      .eq("clinica_id", clinicaId)
      .eq("campanha_id", campanha.id)
      .gte("created_at", inicioIso)
      .lte("created_at", fimIso);

    const linhasEvento = eventos ?? [];
    linhas.push({
      campanha,
      leads: leads ?? 0,
      agendamentos: linhasEvento.filter((l) => l.tipo === "appointment_booked").length,
      fechamentos: linhasEvento.filter((l) => l.tipo === "treatment_closed").length,
      receita: linhasEvento.filter((l) => l.tipo === "treatment_closed").reduce((s, l) => s + ((l.valor as number | null) ?? 0), 0),
      investimento: campanha.investimentoReal,
    });
  }

  return linhas;
}
