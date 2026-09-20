import { getSessaoAtual } from "@/lib/sessao-servidor";
import { listarIncidentesOps, podeAcessarOps } from "@/lib/noryos-ops";
import { OpsForbidden, OpsShell, OpsTable, fmtData } from "@/components/ops/OpsUI";

export default async function OpsIncidentesPage() {
  const sessao = await getSessaoAtual();
  if (!podeAcessarOps(sessao, "ops.incidentes")) return <OpsForbidden />;
  const incidentes = await listarIncidentesOps();
  return (
    <OpsShell ativo="/ops/incidentes">
      <OpsTable>
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-4 py-3">Título</th><th className="px-4 py-3">Severidade</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Clínica</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Criado</th><th className="px-4 py-3">Resolvido</th><th className="px-4 py-3">Causa</th><th className="px-4 py-3">Solução</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {incidentes.map((i) => <tr key={i.id}><td className="px-4 py-3 font-medium">{i.titulo}</td><td className="px-4 py-3">{i.severidade}</td><td className="px-4 py-3">{i.status}</td><td className="px-4 py-3">{i.clinicaNome ?? "—"}</td><td className="px-4 py-3">{i.origem ?? "—"}</td><td className="px-4 py-3">{i.responsavelNome ?? "—"}</td><td className="px-4 py-3">{fmtData(i.criadoEm)}</td><td className="px-4 py-3">{fmtData(i.resolvidoEm)}</td><td className="px-4 py-3 max-w-xs truncate">{i.causa ?? "—"}</td><td className="px-4 py-3 max-w-xs truncate">{i.solucao ?? "—"}</td></tr>)}
          </tbody>
        </table>
      </OpsTable>
    </OpsShell>
  );
}
