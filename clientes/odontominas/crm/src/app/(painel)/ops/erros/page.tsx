import { getSessaoAtual } from "@/lib/sessao-servidor";
import { listarErrosOps, podeAcessarOps } from "@/lib/noryos-ops";
import { OpsForbidden, OpsShell, OpsTable, fmtData } from "@/components/ops/OpsUI";

export default async function OpsErrosPage() {
  const sessao = await getSessaoAtual();
  if (!podeAcessarOps(sessao, "ops.erros")) return <OpsForbidden />;
  const erros = await listarErrosOps();
  return (
    <OpsShell ativo="/ops/erros">
      <OpsTable>
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Serviço</th><th className="px-4 py-3">Clínica</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Severidade</th><th className="px-4 py-3">Mensagem segura</th><th className="px-4 py-3">Correlação</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {erros.map((e) => <tr key={e.id}><td className="px-4 py-3">{fmtData(e.data)}</td><td className="px-4 py-3 font-medium">{e.servico}</td><td className="px-4 py-3">{e.clinicaNome ?? "—"}</td><td className="px-4 py-3">{e.categoria}</td><td className="px-4 py-3">{e.severidade}</td><td className="px-4 py-3 max-w-md truncate">{e.mensagemSegura}</td><td className="px-4 py-3 font-mono text-xs">{e.correlationId ?? "—"}</td><td className="px-4 py-3">{e.status}</td></tr>)}
          </tbody>
        </table>
      </OpsTable>
    </OpsShell>
  );
}
