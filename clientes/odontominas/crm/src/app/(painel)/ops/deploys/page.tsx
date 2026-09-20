import { getSessaoAtual } from "@/lib/sessao-servidor";
import { listarDeploysOps, podeAcessarOps } from "@/lib/noryos-ops";
import { OpsForbidden, OpsShell, OpsTable, fmtData } from "@/components/ops/OpsUI";

export default async function OpsDeploysPage() {
  const sessao = await getSessaoAtual();
  if (!podeAcessarOps(sessao)) return <OpsForbidden />;
  const deploys = await listarDeploysOps();
  return (
    <OpsShell ativo="/ops/deploys">
      <OpsTable>
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-4 py-3">Ambiente</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Commit/SHA</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Deployment ID</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Responsável</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {deploys.map((d) => <tr key={d.id}><td className="px-4 py-3">{d.ambiente}</td><td className="px-4 py-3">{fmtData(d.data)}</td><td className="px-4 py-3 font-mono text-xs">{d.commitSha ?? "—"}</td><td className="px-4 py-3">{d.status}</td><td className="px-4 py-3 font-mono text-xs">{d.deploymentId ?? "—"}</td><td className="px-4 py-3">{d.origem ?? "—"}</td><td className="px-4 py-3">{d.responsavel ?? "—"}</td></tr>)}
          </tbody>
        </table>
      </OpsTable>
    </OpsShell>
  );
}
