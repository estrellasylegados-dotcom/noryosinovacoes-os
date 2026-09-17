import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { listarCampanhas, LABEL_STATUS_CAMPANHA, labelObjetivo, labelTipoCampanha, labelCanal, isStatusCampanhaValido, type StatusCampanha } from "@/lib/campanhas";
import { calcularPainelGeral } from "@/lib/campanha-metricas";
import { isPeriodoValido, inicioPeriodo, type PeriodoRelatorio } from "@/lib/relatorios";
import { listarAtendentes } from "@/lib/atendentes";
import { formatDataHora, formatMoeda } from "@/lib/tempo";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";

export const dynamic = "force-dynamic";

const CORES_STATUS: Record<StatusCampanha, string> = {
  rascunho: "bg-neutral-100 text-neutral-500 ring-neutral-500/20",
  agendada: "bg-blue-50 text-blue-700 ring-blue-600/20",
  ativa: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  pausada: "bg-amber-50 text-amber-700 ring-amber-600/20",
  concluida: "bg-neutral-100 text-neutral-600 ring-neutral-500/20",
  cancelada: "bg-red-50 text-red-700 ring-red-600/20",
};

const ABAS: { valor: StatusCampanha | "todas"; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "ativa", label: "Ativas" },
  { valor: "agendada", label: "Agendadas" },
  { valor: "concluida", label: "Encerradas" },
  { valor: "rascunho", label: "Rascunhos" },
  { valor: "pausada", label: "Pausadas" },
];

function Card({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${destaque ? "border-teal-200 bg-teal-50" : "border-neutral-200 bg-white"}`}>
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${destaque ? "text-teal-800" : "text-neutral-900"}`}>{valor}</p>
    </div>
  );
}

export default async function CampanhasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; periodo?: string }>;
}) {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") redirect("/");

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return <main className="px-4 py-8 sm:px-8">Não consegui conectar ao banco agora.</main>;
  }

  const { status: statusBruto, periodo: periodoBruto } = await searchParams;
  const abaAtiva = statusBruto && isStatusCampanhaValido(statusBruto) ? (statusBruto as StatusCampanha) : "todas";
  const periodo: PeriodoRelatorio = periodoBruto && isPeriodoValido(periodoBruto) ? periodoBruto : "30d";

  const agora = new Date();
  const [campanhas, painel, atendentes] = await Promise.all([
    listarCampanhas(clinicaId, abaAtiva === "todas" ? undefined : { status: abaAtiva }),
    calcularPainelGeral(clinicaId, { inicio: inicioPeriodo(periodo, agora), fim: agora }),
    listarAtendentes(clinicaId),
  ]);

  const nomeAtendente = (id: string | null) => (id ? atendentes.find((a) => a.id === id)?.nome ?? "—" : "—");

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Campanhas</h1>
            <p className="text-sm text-neutral-500">
              O centro estratégico de marketing e conversão da clínica — objetivo, público, canais e resultado.
            </p>
          </div>
          <Link href="/campanhas/nova" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white">
            + Nova campanha
          </Link>
        </header>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <FiltroPeriodo ativo={periodo} basePath="/campanhas" paramsExtras={{ status: abaAtiva === "todas" ? "" : abaAtiva }} />
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card label="Campanhas ativas" valor={String(painel.campanhasAtivas)} destaque />
          <Card label="Leads gerados" valor={String(painel.leads)} />
          <Card label="Agendamentos" valor={String(painel.agendamentos)} />
          <Card label="Fechamentos" valor={String(painel.fechamentos)} />
          <Card label="Receita atribuída" valor={formatMoeda(painel.investimento !== null ? painel.receita : null)} />
          <Card label="Investimento" valor={formatMoeda(painel.investimento)} />
          <Card label="ROAS" valor={painel.roas !== null ? `${painel.roas.toFixed(2)}x` : "—"} />
          <Card label="Qualificados" valor={String(painel.qualificados)} />
        </div>

        <nav className="mb-4 flex flex-wrap gap-1 border-b border-neutral-200">
          {ABAS.map((aba) => (
            <Link
              key={aba.valor}
              href={`/campanhas?status=${aba.valor}&periodo=${periodo}`}
              className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                aba.valor === abaAtiva ? "border-teal-700 text-teal-700" : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {aba.label}
            </Link>
          ))}
        </nav>

        {campanhas.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-400">
            Nenhuma campanha nesta visão ainda.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Campanha</th>
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Objetivo</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Canais</th>
                  <th className="px-4 py-2.5 font-medium">Responsável</th>
                  <th className="px-4 py-2.5 font-medium">Investimento</th>
                  <th className="px-4 py-2.5 font-medium">Criada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {campanhas.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <Link href={`/campanhas/${c.id}`} className="font-medium text-teal-700 hover:underline">
                        {c.nome}
                      </Link>
                      {c.especialidade && <p className="text-xs text-neutral-400">{c.especialidade}</p>}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{labelTipoCampanha(c.tipo)}</td>
                    <td className="px-4 py-3 text-neutral-600">{labelObjetivo(c.objetivo)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${CORES_STATUS[c.status]}`}>
                        {LABEL_STATUS_CAMPANHA[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {c.canais.length > 0 ? c.canais.map(labelCanal).join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{nomeAtendente(c.responsavelId)}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatMoeda(c.investimentoReal)}</td>
                    <td className="px-4 py-3 text-neutral-500">{formatDataHora(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
