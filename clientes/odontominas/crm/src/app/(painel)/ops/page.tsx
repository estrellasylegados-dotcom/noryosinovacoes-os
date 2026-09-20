import { getSessaoAtual } from "@/lib/sessao-servidor";
import { AUDITORIA_NORYOS_OPS, podeAcessarOps, saudePlataforma } from "@/lib/noryos-ops";
import { MetricCard, OpsForbidden, OpsShell, OpsTable, SaudeBadge, fmtData } from "@/components/ops/OpsUI";

export default async function OpsPage() {
  const sessao = await getSessaoAtual();
  if (!podeAcessarOps(sessao)) return <OpsForbidden />;
  const resumo = await saudePlataforma();

  return (
    <OpsShell ativo="/ops">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Saúde geral" value={resumo.saude === "saudavel" ? "OK" : resumo.saude === "critico" ? "Crítica" : "Atenção"} nivel={resumo.saude} />
        <MetricCard label="Clínicas ativas" value={resumo.clinicasAtivas} />
        <MetricCard label="Canais conectados" value={resumo.canaisConectados} />
        <MetricCard label="Canais com problema" value={resumo.canaisComProblema} nivel={resumo.canaisComProblema ? "atencao" : "saudavel"} />
        <MetricCard label="Integrações com erro" value={resumo.integracoesComErro} nivel={resumo.integracoesComErro ? "atencao" : "saudavel"} />
        <MetricCard label="Workers saudáveis" value={resumo.workersSaudaveis} />
        <MetricCard label="Workers com falha" value={resumo.workersComFalha} nivel={resumo.workersComFalha ? "critico" : "saudavel"} />
        <MetricCard label="Incidentes abertos" value={resumo.incidentesAbertos} nivel={resumo.incidentesAbertos ? "critico" : "saudavel"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">Último deploy</h2>
          {resumo.ultimoDeploy ? (
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-neutral-500">Data</dt><dd>{fmtData(resumo.ultimoDeploy.data)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-neutral-500">Status</dt><dd>{resumo.ultimoDeploy.status}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-neutral-500">Commit</dt><dd className="font-mono">{resumo.ultimoDeploy.commitSha?.slice(0, 12) ?? "—"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-neutral-500">Deployment</dt><dd className="font-mono">{resumo.ultimoDeploy.deploymentId ?? "—"}</dd></div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">Nenhuma fonte de deploy persistida nesta fase.</p>
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-neutral-900">Auditoria inicial</h2>
          <div className="mt-3 space-y-2">
            {AUDITORIA_NORYOS_OPS.map((item) => (
              <div key={item.item} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-neutral-700">{item.item}</span>
                <span className="text-xs font-semibold text-neutral-500">{item.classificacao}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <OpsTable>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr><th className="px-4 py-3">Sinal</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Contagem</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            <tr><td className="px-4 py-3">Alertas técnicos críticos</td><td className="px-4 py-3"><SaudeBadge nivel={resumo.alertasTecnicosCriticos ? "atencao" : "saudavel"} /></td><td className="px-4 py-3">{resumo.alertasTecnicosCriticos}</td></tr>
            <tr><td className="px-4 py-3">Erros abertos</td><td className="px-4 py-3"><SaudeBadge nivel={resumo.errosAbertos ? "atencao" : "saudavel"} /></td><td className="px-4 py-3">{resumo.errosAbertos}</td></tr>
          </tbody>
        </table>
      </OpsTable>
    </OpsShell>
  );
}
