import { getSessaoAtual } from "@/lib/sessao-servidor";
import { listarCanaisOps, podeAcessarOps } from "@/lib/noryos-ops";
import { OpsForbidden, OpsShell, OpsTable, SaudeBadge, fmtData } from "@/components/ops/OpsUI";

export default async function OpsCanaisPage() {
  const sessao = await getSessaoAtual();
  if (!podeAcessarOps(sessao, "ops.canais")) return <OpsForbidden />;
  const canais = await listarCanaisOps();
  return (
    <OpsShell ativo="/ops/canais">
      <OpsTable>
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-4 py-3">Clínica</th><th className="px-4 py-3">Canal</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Telefone</th><th className="px-4 py-3">Último webhook</th><th className="px-4 py-3">Entrada</th><th className="px-4 py-3">Saída</th><th className="px-4 py-3">Erro</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {canais.map((c) => <tr key={c.id}><td className="px-4 py-3">{c.clinicaNome}</td><td className="px-4 py-3 font-medium">{c.nome}</td><td className="px-4 py-3">{c.provider}</td><td className="px-4 py-3"><SaudeBadge nivel={c.diagnostico} /></td><td className="px-4 py-3">{c.telefone ?? "—"}</td><td className="px-4 py-3">{fmtData(c.lastWebhookAt)}</td><td className="px-4 py-3">{fmtData(c.lastMessageInAt)}</td><td className="px-4 py-3">{fmtData(c.lastMessageOutAt)}</td><td className="px-4 py-3 max-w-xs truncate">{c.lastError ?? "—"}</td></tr>)}
          </tbody>
        </table>
      </OpsTable>
    </OpsShell>
  );
}
