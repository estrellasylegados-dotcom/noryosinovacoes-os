import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { listarDisparos, type StatusDisparo } from "@/lib/disparos";
import { formatDataHora } from "@/lib/tempo";

export const dynamic = "force-dynamic";

const LABEL_STATUS: Record<StatusDisparo, { texto: string; cor: string }> = {
  rascunho: { texto: "Rascunho", cor: "bg-neutral-100 text-neutral-500 ring-neutral-500/20" },
  enviando: { texto: "Enviando", cor: "bg-teal-50 text-teal-700 ring-teal-600/20" },
  pausada: { texto: "Pausada", cor: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  concluida: { texto: "Concluída", cor: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  cancelada: { texto: "Cancelada", cor: "bg-red-50 text-red-700 ring-red-600/20" },
};

/** Criar/rodar disparo de WhatsApp em massa mexe no número da clínica — só admin. */
export default async function DisparosPage() {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") redirect("/");

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return <main className="px-4 py-8 sm:px-8">Não consegui conectar ao banco agora.</main>;
  }

  const disparos = await listarDisparos(clinicaId);

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Disparos</h1>
            <p className="text-sm text-neutral-500">Envios de WhatsApp em massa — reativação, follow-up, avisos</p>
          </div>
          <Link href="/disparos/nova" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white">
            + Novo disparo
          </Link>
        </header>

        {disparos.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-400">
            Nenhum disparo criado ainda.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Disparo</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Progresso</th>
                  <th className="px-4 py-2.5 font-medium">Criado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {disparos.map((d) => {
                  const status = LABEL_STATUS[d.status];
                  const processados = d.totalEnviados + d.totalFalhas + d.totalPulados;
                  return (
                    <tr key={d.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <Link href={`/disparos/${d.id}`} className="font-medium text-teal-700 hover:underline">
                          {d.nome}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${status.cor}`}>
                          {status.texto}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {processados}/{d.totalDestinatarios}
                        {d.totalFalhas > 0 && <span className="ml-1.5 text-red-600">({d.totalFalhas} falha(s))</span>}
                      </td>
                      <td className="px-4 py-3 text-neutral-500">{formatDataHora(d.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
