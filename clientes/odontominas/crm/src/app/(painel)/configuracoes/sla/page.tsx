import { redirect } from "next/navigation";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { buscarConfiguracaoHorario } from "@/lib/horario-atendimento";
import { buscarResumoSlaHoje, buscarSlaConfig } from "@/lib/sla";
import { SlaConfigForm } from "@/components/SlaConfigForm";

export const dynamic = "force-dynamic";

/** Configuração de SLA + resumo do dia — fundação, ainda não conectada em automação (ver andamento.md). Só admin. */
export default async function SlaPage() {
  const [sessao, clinicaId] = await Promise.all([getSessaoAtual(), getClinicaId()]);

  if (sessao?.papel !== "admin") redirect("/");

  if (!clinicaId) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">Não consegui conectar ao banco do CRM. Confira as variáveis de ambiente do Supabase.</p>
      </main>
    );
  }

  const [config, horario, resumo] = await Promise.all([buscarSlaConfig(clinicaId), buscarConfiguracaoHorario(clinicaId), buscarResumoSlaHoje(clinicaId, new Date())]);
  const horarioConfigurado = (horario?.periodos.length ?? 0) > 0;

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-neutral-900">SLA / Atendimento</h1>
          <p className="text-sm text-neutral-500">
            Tempo de resposta calculado só em minutos úteis (horário de atendimento configurado) — ainda não conectado a alertas automáticos.
          </p>
        </header>

        <SlaConfigForm configInicial={config} horarioConfigurado={horarioConfigurado} />

        {resumo.ativo ? (
          <section className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">SLA hoje</h2>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs text-neutral-500">Dentro do SLA</dt>
                <dd className="text-lg font-semibold text-emerald-700">{resumo.dentro}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Próximos do limite</dt>
                <dd className="text-lg font-semibold text-amber-600">{resumo.proximosDoLimite}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Fora do SLA</dt>
                <dd className="text-lg font-semibold text-red-600">{resumo.foraDoSla}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Fora do expediente</dt>
                <dd className="text-lg font-semibold text-neutral-500">{resumo.pausados}</dd>
              </div>
            </dl>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-neutral-100 pt-3">
              <div>
                <dt className="text-xs text-neutral-500">Primeira resposta média (hoje)</dt>
                <dd className="font-medium text-neutral-900">{resumo.primeiraRespostaMediaMinutos === null ? "—" : `${resumo.primeiraRespostaMediaMinutos} min`}</dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-500">Taxa dentro do SLA</dt>
                <dd className="font-medium text-neutral-900">{resumo.taxaDentroPercentual === null ? "—" : `${resumo.taxaDentroPercentual}%`}</dd>
              </div>
            </div>
          </section>
        ) : (
          <p className="rounded-xl border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-400">
            Ative o SLA acima pra ver o resumo do dia.
          </p>
        )}
      </div>
    </main>
  );
}
