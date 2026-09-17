import type { PainelCampanha } from "@/lib/campanha-metricas";
import { formatPercentual } from "@/lib/tempo";

/**
 * Funil visual da campanha (item 17 do briefing) — barras horizontais com
 * largura proporcional ao maior valor, mesma paleta de `BarChart.tsx`
 * (`var(--chart-series-a)`, teal), sem lib de gráfico nova.
 *
 * O briefing lista "Leads → Conversas → Respondidos → Qualificados →
 * Agendados → Compareceram → Fechamentos": "Conversas" foi dobrada em
 * "Leads" aqui de propósito — esta arquitetura garante 1 conversa por
 * paciente (telefone único por clínica, "path B"), então não é um número
 * distinto de verdade; mostrar os dois seria uma barra idêntica repetida.
 */
export function CampanhaFunil({ painel }: { painel: PainelCampanha }) {
  const etapas = [
    { label: "Leads", valor: painel.leads, taxa: null },
    { label: "Respondidos", valor: painel.respostas, taxa: painel.taxaResposta },
    { label: "Qualificados", valor: painel.qualificados, taxa: null },
    { label: "Agendados", valor: painel.agendamentos, taxa: painel.taxaAgendamento },
    { label: "Compareceram", valor: painel.comparecimentos, taxa: painel.taxaComparecimento },
    { label: "Fecharam", valor: painel.fechamentos, taxa: painel.taxaFechamento },
  ];

  const maior = Math.max(1, ...etapas.map((e) => e.valor));

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-neutral-700">Funil da campanha</h2>
      <div className="space-y-2.5">
        {etapas.map((etapa) => (
          <div key={etapa.label}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-medium text-neutral-600">{etapa.label}</span>
              <span className="text-neutral-500">
                {etapa.valor}
                {etapa.taxa !== null && <span className="ml-1 text-neutral-400">({formatPercentual(etapa.taxa)})</span>}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${(etapa.valor / maior) * 100}%`, background: "var(--chart-series-a)" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
