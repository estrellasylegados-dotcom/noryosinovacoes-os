import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { getControleOdontoConfig } from "@/lib/controle-odonto/config";
import { getControleOdontoCapabilities } from "@/lib/controle-odonto/capabilities";
import { getSyncState } from "@/lib/controle-odonto/sync-state";
import { RECURSO_AGENDAMENTOS } from "@/lib/controle-odonto/sync";
import { formatDataHora } from "@/lib/tempo";
import { ControleOdontoAcoes } from "@/components/integracoes/ControleOdontoAcoes";

export const dynamic = "force-dynamic";

const LABEL_SAUDE: Record<string, { texto: string; cor: string; bolinha: string }> = {
  saudavel: { texto: "Saudável", cor: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", bolinha: "🟢" },
  degradada: { texto: "Degradada", cor: "bg-amber-50 text-amber-700 ring-amber-600/20", bolinha: "🟡" },
  indisponivel: { texto: "Indisponível", cor: "bg-red-50 text-red-700 ring-red-600/20", bolinha: "🔴" },
  nao_configurada: { texto: "Não configurada", cor: "bg-neutral-100 text-neutral-500 ring-neutral-500/20", bolinha: "⚪" },
};

/** Painel de status de uma integração externa é sensível (endpoint, latência, contagem de dado clínico) — só admin. */
export default async function ControleOdontoPage() {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") {
    redirect("/");
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return <main className="px-4 py-8 sm:px-8">Não consegui conectar ao banco agora.</main>;
  }

  const config = getControleOdontoConfig();
  const capabilities = getControleOdontoCapabilities(config);
  const estado = await getSyncState(clinicaId, RECURSO_AGENDAMENTOS);
  const saude = LABEL_SAUDE[estado?.health ?? "nao_configurada"];

  const proximaSync =
    config.syncEnabled && estado?.lastSuccessAt
      ? new Date(new Date(estado.lastSuccessAt).getTime() + config.syncIntervalMinutes * 60_000)
      : null;

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">ControleODONTO</h1>
          <p className="text-sm text-neutral-500">Sincronização de agenda com o sistema de gestão da clínica</p>
        </header>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${saude.cor}`}>
              {saude.bolinha} {saude.texto}
            </span>
            <span className="text-xs text-neutral-400">Conector {estado?.connectorVersion ?? "v0.1.0-preparado"}</span>
          </div>

          {!config.enabled && (
            <p className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
              A comunicação com o ControleODONTO ainda não está configurada. Preencha a URL base e o
              estabelecimento nas variáveis de ambiente do CRM pra começar.
            </p>
          )}

          {config.enabled && !capabilities.canReadAppointments && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              A configuração está presente, mas a leitura de agenda ainda não foi validada contra uma conta
              real do ControleODONTO — nenhuma chamada é feita até isso ser confirmado.
            </p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4 text-sm">
            <div>
              <dt className="text-neutral-500">Última sincronização</dt>
              <dd className="font-medium text-neutral-900">{estado?.lastSuccessAt ? formatDataHora(estado.lastSuccessAt) : "nunca"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Próxima sincronização</dt>
              <dd className="font-medium text-neutral-900">{proximaSync ? formatDataHora(proximaSync.toISOString()) : "—"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Último erro</dt>
              <dd className="font-medium text-neutral-900">{estado?.lastErrorAt ? formatDataHora(estado.lastErrorAt) : "nenhum"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Registros na última sincronização</dt>
              <dd className="font-medium text-neutral-900">{estado?.lastRunCount ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Tempo da última chamada</dt>
              <dd className="font-medium text-neutral-900">{estado?.lastDurationMs ? `${estado.lastDurationMs}ms` : "—"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Falhas seguidas</dt>
              <dd className="font-medium text-neutral-900">{estado?.consecutiveFailures ?? 0}</dd>
            </div>
          </dl>

          <ControleOdontoAcoes />
        </div>
      </div>
    </main>
  );
}
