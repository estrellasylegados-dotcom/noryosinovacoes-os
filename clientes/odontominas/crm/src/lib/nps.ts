import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Fase 4 — a coluna `pesquisa_respostas.classificacao` nasceu reservada na
 * Fase 3 (migration v22) especificamente para esta regra: escala padrão de
 * NPS, 0-10 inteiro. Fora da faixa ou não-inteiro não classifica (satisfação
 * usa a mesma tabela sem essa escala, e não deve cair em nenhum balde).
 */
export type ClassificacaoNps = "detrator" | "neutro" | "promotor";

export function classificarNps(nota: number): ClassificacaoNps | null {
  if (!Number.isInteger(nota) || nota < 0 || nota > 10) return null;
  if (nota <= 6) return "detrator";
  if (nota <= 8) return "neutro";
  return "promotor";
}

export type PainelNps = {
  enviadas: number;
  respondidas: number;
  taxaResposta: number | null;
  promotores: number;
  neutros: number;
  detratores: number;
  scoreNps: number | null;
};

/**
 * Núcleo puro (mesmo desenho de `campanha-metricas.ts:calcularMetricas`):
 * nunca 0%/Infinity quando não há dado suficiente — `null` em vez disso.
 */
export function calcularPainelNps(
  pesquisas: { status: string }[],
  respostas: { classificacao: string | null }[]
): PainelNps {
  const enviadas = pesquisas.length;
  const respondidas = respostas.length;
  const promotores = respostas.filter((r) => r.classificacao === "promotor").length;
  const neutros = respostas.filter((r) => r.classificacao === "neutro").length;
  const detratores = respostas.filter((r) => r.classificacao === "detrator").length;

  return {
    enviadas,
    respondidas,
    taxaResposta: enviadas > 0 ? respondidas / enviadas : null,
    promotores,
    neutros,
    detratores,
    scoreNps: respondidas > 0 ? Math.round(((promotores - detratores) / respondidas) * 100) : null,
  };
}

/**
 * Busca em 2 passos (sem embed/RPC — mesmo estilo direto do resto do
 * projeto): pesquisas de tipo 'nps' no período, depois as respostas ligadas
 * a elas.
 */
export async function buscarPainelNps(clinicaId: string, periodo: { inicio: Date; fim: Date }): Promise<PainelNps> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return calcularPainelNps([], []);

  const { data: pesquisas, error: erroPesquisas } = await supabase
    .from("pesquisas")
    .select("id, status")
    .eq("clinica_id", clinicaId)
    .eq("tipo", "nps")
    .gte("enviado_em", periodo.inicio.toISOString())
    .lte("enviado_em", periodo.fim.toISOString());

  if (erroPesquisas || !pesquisas) return calcularPainelNps([], []);
  if (pesquisas.length === 0) return calcularPainelNps([], []);

  const { data: respostas, error: erroRespostas } = await supabase
    .from("pesquisa_respostas")
    .select("classificacao")
    .in(
      "pesquisa_id",
      pesquisas.map((p) => p.id)
    );

  return calcularPainelNps(pesquisas, erroRespostas || !respostas ? [] : respostas);
}
