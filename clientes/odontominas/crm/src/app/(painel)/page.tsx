import Link from "next/link";
import { buscarClinicaAtual, getClinicaId } from "@/lib/clinica";
import { contarPorStatus, listarConversas } from "@/lib/conversas";
import { isStatusValido, LIMITE_ESPERA_MS, type StatusConversa } from "@/lib/status";
import { formatDataHora, formatDuracao, formatTelefone } from "@/lib/tempo";
import { StatusSelect } from "@/components/StatusSelect";
import { FiltroStatus } from "@/components/FiltroStatus";

export const dynamic = "force-dynamic";

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusBruto } = await searchParams;
  const filtroStatus: StatusConversa | undefined =
    statusBruto && isStatusValido(statusBruto) ? statusBruto : undefined;

  const clinicaId = await getClinicaId();

  if (!clinicaId) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">
          Não consegui conectar ao banco do CRM. Confira as variáveis de ambiente do Supabase.
        </p>
      </main>
    );
  }

  const [conversas, contagens, clinicaAtual] = await Promise.all([
    listarConversas(clinicaId, filtroStatus),
    contarPorStatus(clinicaId),
    buscarClinicaAtual(),
  ]);
  const total = Object.values(contagens).reduce((a, b) => a + b, 0);

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">Painel de Atendimento</h1>
          <p className="text-sm text-neutral-500">{clinicaAtual?.nome ?? "Clínica"} — conversas do WhatsApp</p>
        </header>

        <div className="mb-6">
          <FiltroStatus ativo={filtroStatus} contagens={contagens} total={total} />
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Contato</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">1ª resposta</th>
                <th className="px-4 py-3 font-medium">Última mensagem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {conversas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-neutral-400">
                    Nenhuma conversa {filtroStatus ? `com status "${filtroStatus}"` : "ainda"}.
                  </td>
                </tr>
              )}
              {conversas.map((c) => {
                const emAberto = c.status === "novo" || c.status === "aguardando";
                const atrasado = emAberto && (c.tempoPrimeiraRespostaMs ?? 0) > LIMITE_ESPERA_MS;

                return (
                  <tr key={c.id} className="align-top">
                    <td className="px-4 py-3">
                      {c.pacienteId ? (
                        <Link href={`/pacientes/${c.pacienteId}`} className="font-medium text-neutral-900 hover:underline">
                          {c.pacienteNome || "Sem nome"}
                        </Link>
                      ) : (
                        <div className="font-medium text-neutral-900">{c.pacienteNome || "Sem nome"}</div>
                      )}
                      <div className="text-xs text-neutral-500">{formatTelefone(c.telefone)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusSelect conversaId={c.id} statusAtual={c.status} />
                    </td>
                    <td className="px-4 py-3">
                      {c.tempoPrimeiraRespostaMs === null ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <span
                          className={
                            emAberto
                              ? atrasado
                                ? "font-semibold text-red-600"
                                : "text-amber-600"
                              : "text-emerald-600"
                          }
                        >
                          {emAberto
                            ? `esperando há ${formatDuracao(c.tempoPrimeiraRespostaMs)}`
                            : `respondeu em ${formatDuracao(c.tempoPrimeiraRespostaMs)}`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{formatDataHora(c.ultimaMensagemEm)}</td>
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
