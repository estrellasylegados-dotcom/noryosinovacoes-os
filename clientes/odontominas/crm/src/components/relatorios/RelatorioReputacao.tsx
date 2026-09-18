import type { PainelReputacao } from "@/lib/reputacao-metricas";
import { formatPercentual } from "@/lib/tempo";

/** Fase 5 — mesmos tokens visuais de RelatorioNps.tsx (stat-tiles). Nunca mostra "avaliações recebidas": não há como provar publicação sem integração real. */
export function RelatorioReputacao({ painel }: { painel: PainelReputacao }) {
  if (painel.total === 0) {
    return (
      <p className="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-400">
        Nenhuma solicitação de avaliação Google neste período.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-3">
        <p className="text-xs text-neutral-500">Solicitações enviadas</p>
        <p className="text-lg font-semibold text-neutral-900">{painel.enviadas}</p>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-3">
        <p className="text-xs text-neutral-500">Links clicados</p>
        <p className="text-lg font-semibold text-neutral-900">{painel.clicadas}</p>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-3">
        <p className="text-xs text-neutral-500">Taxa de clique</p>
        <p className="text-lg font-semibold text-neutral-900">{painel.taxaClique === null ? "—" : formatPercentual(painel.taxaClique)}</p>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-3">
        <p className="text-xs text-neutral-500">Falhas</p>
        <p className="text-lg font-semibold text-neutral-900">{painel.falhas}</p>
      </div>
    </div>
  );
}
