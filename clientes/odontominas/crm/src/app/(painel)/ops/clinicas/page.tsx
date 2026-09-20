import { getSessaoAtual } from "@/lib/sessao-servidor";
import { listarClinicasOps, podeAcessarOps } from "@/lib/noryos-ops";
import { OpsForbidden, OpsShell, OpsTable, SaudeBadge, fmtData } from "@/components/ops/OpsUI";

export default async function OpsClinicasPage() {
  const sessao = await getSessaoAtual();
  if (!podeAcessarOps(sessao, "ops.clinicas")) return <OpsForbidden />;
  const clinicas = await listarClinicasOps();
  return (
    <OpsShell ativo="/ops/clinicas">
      <OpsTable>
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-4 py-3">Clínica</th><th className="px-4 py-3">Saúde</th><th className="px-4 py-3">Módulos</th><th className="px-4 py-3">Canais</th><th className="px-4 py-3">Integrações</th><th className="px-4 py-3">Último uso</th><th className="px-4 py-3">Alertas</th><th className="px-4 py-3">Incidentes</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {clinicas.map((c) => (
              <tr key={c.id}><td className="px-4 py-3 font-medium text-neutral-900">{c.nome}<span className="block text-xs text-neutral-500">{c.slug}</span></td><td className="px-4 py-3"><SaudeBadge nivel={c.saude} /></td><td className="px-4 py-3">{c.modulosAtivos.join(", ")}</td><td className="px-4 py-3">{c.canais} ({c.canaisComProblema} problema)</td><td className="px-4 py-3">{c.integracoes}</td><td className="px-4 py-3">{fmtData(c.ultimoUsoEm)}</td><td className="px-4 py-3">{c.alertasTecnicos}</td><td className="px-4 py-3">{c.incidentesAbertos}</td></tr>
            ))}
          </tbody>
        </table>
      </OpsTable>
    </OpsShell>
  );
}
