import { notFound, redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { buscarCampanhaComRelatorio, type StatusCampanha, type StatusDestinatario } from "@/lib/campanhas";
import { formatDataHora, formatTelefone } from "@/lib/tempo";
import { AutoRefresh } from "@/components/AutoRefresh";
import { DisparosCampanhaAcoes } from "@/components/disparos/DisparosCampanhaAcoes";

export const dynamic = "force-dynamic";

const LABEL_STATUS_CAMPANHA: Record<StatusCampanha, { texto: string; cor: string }> = {
  rascunho: { texto: "Rascunho", cor: "bg-neutral-100 text-neutral-500 ring-neutral-500/20" },
  enviando: { texto: "Enviando", cor: "bg-teal-50 text-teal-700 ring-teal-600/20" },
  pausada: { texto: "Pausada", cor: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  concluida: { texto: "Concluída", cor: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  cancelada: { texto: "Cancelada", cor: "bg-red-50 text-red-700 ring-red-600/20" },
};

const LABEL_STATUS_DESTINATARIO: Record<StatusDestinatario, { texto: string; cor: string }> = {
  pendente: { texto: "Pendente", cor: "bg-neutral-100 text-neutral-500 ring-neutral-500/20" },
  enviado: { texto: "Enviado", cor: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  falha: { texto: "Falha", cor: "bg-red-50 text-red-700 ring-red-600/20" },
  pulado_opt_out: { texto: "Pulado (opt-out)", cor: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  telefone_invalido: { texto: "Telefone inválido", cor: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  cancelado: { texto: "Cancelado", cor: "bg-neutral-100 text-neutral-500 ring-neutral-500/20" },
};

export default async function DisparosCampanhaPage({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") redirect("/");

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return <main className="px-4 py-8 sm:px-8">Não consegui conectar ao banco agora.</main>;
  }

  const { id } = await params;
  const campanha = await buscarCampanhaComRelatorio(clinicaId, id);
  if (!campanha) notFound();

  const status = LABEL_STATUS_CAMPANHA[campanha.status];
  const pendentes = campanha.totalDestinatarios - campanha.totalEnviados - campanha.totalFalhas - campanha.totalPulados;

  return (
    <main className="px-4 py-8 sm:px-8">
      {campanha.status === "enviando" && <AutoRefresh intervaloMs={5000} />}
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-neutral-900">{campanha.nome}</h1>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${status.cor}`}>{status.texto}</span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">{campanha.mensagemTexto}</p>
        </header>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-neutral-500">Destinatários</dt>
              <dd className="font-medium text-neutral-900">{campanha.totalDestinatarios}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Enviados</dt>
              <dd className="font-medium text-emerald-700">{campanha.totalEnviados}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Falhas</dt>
              <dd className="font-medium text-red-600">{campanha.totalFalhas}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Pulados</dt>
              <dd className="font-medium text-amber-700">{campanha.totalPulados}</dd>
            </div>
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4 text-sm">
            <div>
              <dt className="text-neutral-500">Pendentes</dt>
              <dd className="font-medium text-neutral-900">{Math.max(0, pendentes)}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Iniciada em</dt>
              <dd className="font-medium text-neutral-900">{formatDataHora(campanha.iniciadoEm)}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Concluída em</dt>
              <dd className="font-medium text-neutral-900">{formatDataHora(campanha.concluidoEm)}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Criada em</dt>
              <dd className="font-medium text-neutral-900">{formatDataHora(campanha.createdAt)}</dd>
            </div>
          </div>

          <DisparosCampanhaAcoes campanhaId={campanha.id} status={campanha.status} />
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Paciente</th>
                <th className="px-4 py-2.5 font-medium">Telefone</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Enviado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {campanha.destinatarios.map((d) => {
                const statusDestinatario = LABEL_STATUS_DESTINATARIO[d.status];
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-2.5 text-neutral-900">{d.nome ?? "—"}</td>
                    <td className="px-4 py-2.5 text-neutral-600">{formatTelefone(d.telefone)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${statusDestinatario.cor}`}>
                        {statusDestinatario.texto}
                      </span>
                      {d.erro && <span className="ml-1.5 text-[11px] text-neutral-400">{d.erro}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500">{formatDataHora(d.enviadoEm)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
