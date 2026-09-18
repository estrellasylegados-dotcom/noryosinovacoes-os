import type { PainelNps } from "@/lib/nps";
import { formatPercentual } from "@/lib/tempo";

/**
 * Relatórios → Pesquisas (Fase 4 do Fluxo de Conversa / "Noryos Odonto") —
 * mesmos tokens visuais de `RelatorioMarketing.tsx` (stat-tiles) e
 * `CampanhaFunil.tsx` (track `h-2 rounded-full bg-neutral-100`), mas com uma
 * barra única segmentada em vez da lista de barras do funil, porque aqui as
 * 3 categorias somam 100% de um mesmo total (respondidas), não etapas de um
 * funil sequencial.
 */
export function RelatorioNps({ painel }: { painel: PainelNps }) {
  if (painel.enviadas === 0) {
    return (
      <p className="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-400">
        Nenhuma pesquisa de NPS enviada neste período.
      </p>
    );
  }

  const segmentos = [
    { label: "Detratores", valor: painel.detratores, cor: "bg-red-600" },
    { label: "Neutros", valor: painel.neutros, cor: "bg-amber-400" },
    { label: "Promotores", valor: painel.promotores, cor: "bg-teal-700" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-500">Pesquisas enviadas</p>
          <p className="text-lg font-semibold text-neutral-900">{painel.enviadas}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-500">Respondidas</p>
          <p className="text-lg font-semibold text-neutral-900">{painel.respondidas}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-500">Taxa de resposta</p>
          <p className="text-lg font-semibold text-neutral-900">
            {painel.taxaResposta === null ? "—" : formatPercentual(painel.taxaResposta)}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-500">NPS Score</p>
          <p className="text-lg font-semibold text-neutral-900">{painel.scoreNps === null ? "—" : painel.scoreNps}</p>
        </div>
      </div>

      {painel.respondidas > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-neutral-700">Distribuição das respostas</h2>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
            {segmentos.map(
              (s) =>
                s.valor > 0 && (
                  <div
                    key={s.label}
                    className={s.cor}
                    style={{ width: `${(s.valor / painel.respondidas) * 100}%` }}
                  />
                )
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
            {segmentos.map((s) => (
              <span key={s.label} className="flex items-center gap-1.5 text-neutral-600">
                <span className={`inline-block h-2 w-2 rounded-full ${s.cor}`} />
                {s.label}: {s.valor} ({formatPercentual(s.valor / painel.respondidas)})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
