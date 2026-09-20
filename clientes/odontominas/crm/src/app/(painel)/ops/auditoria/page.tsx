import { getSessaoAtual } from "@/lib/sessao-servidor";
import { listarAuditoriaOps, podeAcessarOps } from "@/lib/noryos-ops";
import { OpsForbidden, OpsShell, OpsTable, fmtData } from "@/components/ops/OpsUI";

export default async function OpsAuditoriaPage() {
  const sessao = await getSessaoAtual();
  if (!podeAcessarOps(sessao, "ops.auditoria")) return <OpsForbidden />;
  const eventos = await listarAuditoriaOps();
  return (
    <OpsShell ativo="/ops/auditoria">
      <OpsTable>
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Perfil</th><th className="px-4 py-3">Clínica</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Alvo</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {eventos.map((e) => <tr key={e.id}><td className="px-4 py-3">{fmtData(e.data)}</td><td className="px-4 py-3">{e.usuario ?? "Sistema"}</td><td className="px-4 py-3">{e.perfil ?? "—"}</td><td className="px-4 py-3">{e.clinicaNome ?? "—"}</td><td className="px-4 py-3 font-medium">{e.acao}</td><td className="px-4 py-3 font-mono text-xs">{e.alvoId ?? "—"}</td></tr>)}
          </tbody>
        </table>
      </OpsTable>
    </OpsShell>
  );
}
