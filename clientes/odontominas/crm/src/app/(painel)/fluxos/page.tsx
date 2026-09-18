import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { listarFluxos, isStatusFluxoValido, type StatusFluxo } from "@/lib/fluxo-versoes";
import { formatDataHora } from "@/lib/tempo";
import { FluxoAcoes } from "@/components/fluxos/FluxoAcoes";

export const dynamic = "force-dynamic";

const CORES_STATUS: Record<StatusFluxo, string> = {
  ativo: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  pausado: "bg-amber-50 text-amber-700 ring-amber-600/20",
  arquivado: "bg-neutral-100 text-neutral-500 ring-neutral-500/20",
};

const LABEL_STATUS: Record<StatusFluxo, string> = { ativo: "Ativo", pausado: "Pausado", arquivado: "Arquivado" };

const ABAS: { valor: StatusFluxo | "todos"; label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "ativo", label: "Ativos" },
  { valor: "pausado", label: "Pausados" },
  { valor: "arquivado", label: "Arquivados" },
];

export default async function FluxosPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) redirect("/");

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return <main className="px-4 py-8 sm:px-8">Não consegui conectar ao banco agora.</main>;
  }

  const { status: statusBruto } = await searchParams;
  const abaAtiva = statusBruto && isStatusFluxoValido(statusBruto) ? (statusBruto as StatusFluxo) : "todos";

  const fluxos = await listarFluxos(clinicaId, abaAtiva === "todos" ? undefined : { status: abaAtiva });

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Fluxo de Conversa</h1>
          <p className="text-sm text-neutral-500">Automação determinística — menus, condições, espera, roteamento.</p>
        </div>
        <Link href="/fluxos/nova" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
          + Novo fluxo
        </Link>
      </div>

      <nav className="mb-4 flex gap-1 border-b border-neutral-200">
        {ABAS.map((aba) => (
          <Link
            key={aba.valor}
            href={aba.valor === "todos" ? "/fluxos" : `/fluxos?status=${aba.valor}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              abaAtiva === aba.valor ? "border-teal-700 text-teal-800" : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {aba.label}
          </Link>
        ))}
      </nav>

      {fluxos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center text-sm text-neutral-500">
          Nenhum fluxo {abaAtiva !== "todos" ? LABEL_STATUS[abaAtiva as StatusFluxo].toLowerCase() : "criado"} ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Versão publicada</th>
                <th className="px-4 py-3">Gatilho</th>
                <th className="px-4 py-3">Última edição</th>
                <th className="px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {fluxos.map((fluxo) => (
                <tr key={fluxo.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/fluxos/${fluxo.id}/editar`} className="font-medium text-neutral-900 hover:underline">
                      {fluxo.nome}
                    </Link>
                    {fluxo.descricao && <p className="mt-0.5 text-xs text-neutral-500">{fluxo.descricao}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${CORES_STATUS[fluxo.status]}`}>
                      {LABEL_STATUS[fluxo.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {fluxo.versaoPublicadaNumero ? (
                      <>
                        v{fluxo.versaoPublicadaNumero}
                        {fluxo.versaoPublicadaEm && (
                          <span className="ml-1 text-xs text-neutral-400">{formatDataHora(fluxo.versaoPublicadaEm)}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-neutral-400">nunca publicado</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{fluxo.gatilhoTipo ?? <span className="text-neutral-400">sem gatilho</span>}</td>
                  <td className="px-4 py-3 text-neutral-500">{formatDataHora(fluxo.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <FluxoAcoes id={fluxo.id} status={fluxo.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
