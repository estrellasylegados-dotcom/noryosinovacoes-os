import { getSessaoAtual } from "@/lib/sessao-servidor";
import { listarWorkersOps, podeAcessarOps } from "@/lib/noryos-ops";
import { OpsForbidden, OpsShell, OpsTable, SaudeBadge, fmtData } from "@/components/ops/OpsUI";

export default async function OpsWorkersPage() {
  const sessao = await getSessaoAtual();
  if (!podeAcessarOps(sessao, "ops.workers")) return <OpsForbidden />;
  const workers = await listarWorkersOps();
  return (
    <OpsShell ativo="/ops/workers">
      <OpsTable>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-4 py-3">Worker</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Heartbeat</th><th className="px-4 py-3">Última execução</th><th className="px-4 py-3">Última falha</th><th className="px-4 py-3">Fila</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {workers.map((w) => <tr key={w.nome}><td className="px-4 py-3 font-medium">{w.nome}</td><td className="px-4 py-3"><SaudeBadge nivel={w.status} /></td><td className="px-4 py-3">{fmtData(w.ultimoHeartbeatEm)}</td><td className="px-4 py-3">{fmtData(w.ultimaExecucaoEm)}</td><td className="px-4 py-3">{fmtData(w.ultimaFalhaEm)}</td><td className="px-4 py-3">{w.filaPendente ?? "—"}</td></tr>)}
          </tbody>
        </table>
      </OpsTable>
    </OpsShell>
  );
}
