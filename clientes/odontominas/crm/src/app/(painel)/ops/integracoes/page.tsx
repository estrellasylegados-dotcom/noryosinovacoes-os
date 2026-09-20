import { getSessaoAtual } from "@/lib/sessao-servidor";
import { listarIntegracoesOps, podeAcessarOps } from "@/lib/noryos-ops";
import { OpsForbidden, OpsShell, OpsTable, SaudeBadge, fmtData } from "@/components/ops/OpsUI";

export default async function OpsIntegracoesPage() {
  const sessao = await getSessaoAtual();
  if (!podeAcessarOps(sessao, "ops.integracoes")) return <OpsForbidden />;
  const integracoes = await listarIntegracoesOps();
  return (
    <OpsShell ativo="/ops/integracoes">
      <OpsTable>
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr><th className="px-4 py-3">Integração</th><th className="px-4 py-3">Clínica</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Último sucesso</th><th className="px-4 py-3">Último erro</th><th className="px-4 py-3">Diagnóstico</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {integracoes.map((i, idx) => <tr key={`${i.provider}-${i.clinicaId ?? "global"}-${idx}`}><td className="px-4 py-3 font-medium">{i.provider}</td><td className="px-4 py-3">{i.clinicaNome ?? "Plataforma"}</td><td className="px-4 py-3"><SaudeBadge nivel={i.status} /></td><td className="px-4 py-3">{fmtData(i.ultimoSucessoEm)}</td><td className="px-4 py-3">{fmtData(i.ultimoErroEm)}</td><td className="px-4 py-3 max-w-sm truncate">{i.detalhe ?? "—"}</td></tr>)}
          </tbody>
        </table>
      </OpsTable>
    </OpsShell>
  );
}
