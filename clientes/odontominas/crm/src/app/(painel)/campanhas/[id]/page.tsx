import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { buscarCampanha, LABEL_STATUS_CAMPANHA, labelObjetivo, labelTipoCampanha, labelCanal, type StatusCampanha } from "@/lib/campanhas";
import { calcularPainelCampanha } from "@/lib/campanha-metricas";
import { listarDisparosPorCampanha, type StatusDisparo } from "@/lib/disparos";
import { listarPacientesDaCampanha } from "@/lib/pacientes";
import { listarAtendentes } from "@/lib/atendentes";
import { formatDataHora, formatMoeda } from "@/lib/tempo";
import { CampanhaAcoes } from "@/components/campanhas/CampanhaAcoes";
import { CampanhaFunil } from "@/components/campanhas/CampanhaFunil";
import { CampanhaEventoManual } from "@/components/campanhas/CampanhaEventoManual";

export const dynamic = "force-dynamic";

const CORES_STATUS: Record<StatusCampanha, string> = {
  rascunho: "bg-neutral-100 text-neutral-500 ring-neutral-500/20",
  agendada: "bg-blue-50 text-blue-700 ring-blue-600/20",
  ativa: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  pausada: "bg-amber-50 text-amber-700 ring-amber-600/20",
  concluida: "bg-neutral-100 text-neutral-600 ring-neutral-500/20",
  cancelada: "bg-red-50 text-red-700 ring-red-600/20",
};

const CORES_STATUS_DISPARO: Record<StatusDisparo, string> = {
  rascunho: "bg-neutral-100 text-neutral-500 ring-neutral-500/20",
  enviando: "bg-teal-50 text-teal-700 ring-teal-600/20",
  pausada: "bg-amber-50 text-amber-700 ring-amber-600/20",
  concluida: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  cancelada: "bg-red-50 text-red-700 ring-red-600/20",
};

function Card({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{valor}</p>
    </div>
  );
}

export default async function CampanhaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) redirect("/");

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return <main className="px-4 py-8 sm:px-8">Não consegui conectar ao banco agora.</main>;
  }

  const { id } = await params;
  const campanha = await buscarCampanha(clinicaId, id);
  if (!campanha) notFound();

  const [painel, disparos, pacientes, atendentes] = await Promise.all([
    calcularPainelCampanha(clinicaId, id),
    listarDisparosPorCampanha(clinicaId, id),
    listarPacientesDaCampanha(clinicaId, id),
    listarAtendentes(clinicaId),
  ]);

  const nomeAtendente = (atendenteId: string | null) => (atendenteId ? atendentes.find((a) => a.id === atendenteId)?.nome ?? "—" : "—");
  const temInvestimento = campanha.investimentoReal !== null;

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/campanhas" className="text-sm font-medium text-teal-700 hover:underline">
          ← Campanhas
        </Link>

        <header className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-neutral-900">{campanha.nome}</h1>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${CORES_STATUS[campanha.status]}`}>
                {LABEL_STATUS_CAMPANHA[campanha.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {labelTipoCampanha(campanha.tipo)} · {labelObjetivo(campanha.objetivo)}
              {campanha.especialidade ? ` · ${campanha.especialidade}` : ""}
            </p>
            {campanha.descricao && <p className="mt-1 text-sm text-neutral-500">{campanha.descricao}</p>}
          </div>
          <Link href={`/campanhas/${campanha.id}/editar`} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100">
            Editar
          </Link>
        </header>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <CampanhaAcoes campanhaId={campanha.id} status={campanha.status} />
        </div>

        {painel && (
          <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card label="Leads" valor={String(painel.leads)} />
            <Card label="Respondidos" valor={String(painel.respostas)} />
            <Card label="Agendamentos" valor={String(painel.agendamentos)} />
            <Card label="Fechamentos" valor={String(painel.fechamentos)} />
            {temInvestimento && (
              <>
                <Card label="Investimento" valor={formatMoeda(painel.investimento)} />
                <Card label="Receita" valor={formatMoeda(painel.receita)} />
                <Card label="CPL" valor={formatMoeda(painel.cpl)} />
                <Card label="ROAS" valor={painel.roas !== null ? `${painel.roas.toFixed(2)}x` : "—"} />
              </>
            )}
          </div>
        )}

        {painel && (
          <div className="mb-6">
            <CampanhaFunil painel={painel} />
          </div>
        )}

        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-medium text-neutral-700">Registrar comparecimento ou fechamento</h2>
          <CampanhaEventoManual campanhaId={campanha.id} pacientes={pacientes} />
        </div>

        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-700">Disparos vinculados</h2>
            <Link href={`/disparos/nova?campanhaId=${campanha.id}`} className="text-xs font-medium text-teal-700 hover:underline">
              + Novo disparo desta campanha
            </Link>
          </div>
          {disparos.length === 0 ? (
            <p className="rounded-xl border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-400">
              Nenhum disparo vinculado ainda.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-400">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Disparo</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Progresso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {disparos.map((d) => (
                    <tr key={d.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <Link href={`/disparos/${d.id}`} className="font-medium text-teal-700 hover:underline">{d.nome}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${CORES_STATUS_DISPARO[d.status]}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{d.totalEnviados + d.totalFalhas + d.totalPulados}/{d.totalDestinatarios}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 text-xs text-neutral-500">
          <h2 className="mb-2 text-sm font-medium text-neutral-700">Auditoria</h2>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div><dt>Criada por</dt><dd className="font-medium text-neutral-700">{nomeAtendente(campanha.criadoPor)}</dd></div>
            <div><dt>Criada em</dt><dd className="font-medium text-neutral-700">{formatDataHora(campanha.createdAt)}</dd></div>
            <div><dt>Iniciada por</dt><dd className="font-medium text-neutral-700">{nomeAtendente(campanha.iniciadoPor)} {campanha.iniciadoEm ? `· ${formatDataHora(campanha.iniciadoEm)}` : ""}</dd></div>
            <div><dt>Pausada por</dt><dd className="font-medium text-neutral-700">{nomeAtendente(campanha.pausadoPor)} {campanha.pausadoEm ? `· ${formatDataHora(campanha.pausadoEm)}` : ""}</dd></div>
            <div><dt>Encerrada por</dt><dd className="font-medium text-neutral-700">{nomeAtendente(campanha.encerradoPor)} {campanha.encerradoEm ? `· ${formatDataHora(campanha.encerradoEm)}` : ""}</dd></div>
            <div><dt>Cancelada por</dt><dd className="font-medium text-neutral-700">{nomeAtendente(campanha.canceladoPor)} {campanha.canceladoEm ? `· ${formatDataHora(campanha.canceladoEm)}` : ""}</dd></div>
          </dl>
        </div>

        {campanha.canais.length > 0 && (
          <p className="mt-4 text-xs text-neutral-400">Canais: {campanha.canais.map(labelCanal).join(", ")}</p>
        )}
      </div>
    </main>
  );
}
