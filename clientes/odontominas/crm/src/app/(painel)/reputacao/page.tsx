import Link from "next/link";
import { redirect } from "next/navigation";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { buscarConfigReputacao } from "@/lib/reputacao-config";
import {
  buscarPainelReputacao,
  LABEL_STATUS_REPUTACAO,
  listarSolicitacoesReputacao,
  ORIGEM_REPUTACAO_ATUAL,
} from "@/lib/reputacao-metricas";
import { inicioPeriodo, isPeriodoValido, PERIODO_CONFIG, type PeriodoRelatorio } from "@/lib/relatorios";
import { formatDataHora } from "@/lib/tempo";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { RelatorioReputacao } from "@/components/relatorios/RelatorioReputacao";
import { ReputacaoConfigForm } from "@/components/relatorios/ReputacaoConfigForm";

export const dynamic = "force-dynamic";

const STATUS_FILTRO = ["enviada", "clicada", "falhou"] as const;

/** Fase 5 — Reputação/Google Reviews: dashboard + listagem + config. Só admin, mesmo gate de Relatórios/Ferramentas. */
export default async function ReputacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; status?: string }>;
}) {
  const [sessao, clinicaId, { periodo: periodoBruto, status: statusBruto }] = await Promise.all([
    getSessaoAtual(),
    getClinicaId(),
    searchParams,
  ]);

  if (sessao?.papel !== "admin") redirect("/");

  if (!clinicaId) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">Não consegui conectar ao banco do CRM. Confira as variáveis de ambiente do Supabase.</p>
      </main>
    );
  }

  const periodo: PeriodoRelatorio = periodoBruto && isPeriodoValido(periodoBruto) ? periodoBruto : "30d";
  const status = statusBruto && (STATUS_FILTRO as readonly string[]).includes(statusBruto) ? statusBruto : undefined;

  const agora = new Date();
  const intervalo = { inicio: inicioPeriodo(periodo, agora), fim: agora };

  const [config, painel, solicitacoes] = await Promise.all([
    buscarConfigReputacao(clinicaId),
    buscarPainelReputacao(clinicaId, intervalo),
    listarSolicitacoesReputacao(clinicaId, intervalo, status),
  ]);

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-neutral-900">Reputação</h1>
          <p className="text-sm text-neutral-500">Solicitações de avaliação no Google — link, envio e clique.</p>
        </header>

        <ReputacaoConfigForm configInicial={config} />

        {!config.ativo && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Módulo desativado — a ação &ldquo;Solicitar avaliação Google&rdquo; na ficha do paciente não vai funcionar até ativar aqui e
            publicar um Fluxo com o gatilho &ldquo;Solicitação de avaliação Google&rdquo; (Fluxos → template &ldquo;Solicitação de
            Avaliação Google&rdquo;).
          </p>
        )}

        <FiltroPeriodo ativo={periodo} basePath="/reputacao" paramsExtras={{ status: status ?? "" }} />

        <RelatorioReputacao painel={painel} />

        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">Histórico</h2>
            <nav className="flex flex-wrap gap-1.5 text-xs">
              <Link
                href={`/reputacao?periodo=${periodo}`}
                className={`rounded-full px-2.5 py-1 font-medium ${!status ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-600"}`}
              >
                Todas
              </Link>
              {STATUS_FILTRO.map((s) => (
                <Link
                  key={s}
                  href={`/reputacao?periodo=${periodo}&status=${s}`}
                  className={`rounded-full px-2.5 py-1 font-medium ${status === s ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-600"}`}
                >
                  {LABEL_STATUS_REPUTACAO[s]}
                </Link>
              ))}
            </nav>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="px-3 py-2 font-medium">Paciente</th>
                  <th className="px-3 py-2 font-medium">Solicitado em</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Clicado em</th>
                  <th className="px-3 py-2 font-medium">Origem</th>
                </tr>
              </thead>
              <tbody>
                {solicitacoes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-neutral-400">
                      Nenhuma solicitação no período.
                    </td>
                  </tr>
                )}
                {solicitacoes.map((s) => (
                  <tr key={s.id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-3 py-2 text-neutral-800">{s.pacienteNome || "Sem nome"}</td>
                    <td className="px-3 py-2 text-neutral-500">{formatDataHora(s.enviadoEm)}</td>
                    <td className="px-3 py-2 text-neutral-800">{LABEL_STATUS_REPUTACAO[s.status] ?? s.status}</td>
                    <td className="px-3 py-2 text-neutral-500">{s.clicadoEm ? formatDataHora(s.clicadoEm) : "—"}</td>
                    <td className="px-3 py-2 text-neutral-500">{ORIGEM_REPUTACAO_ATUAL}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-xs text-neutral-400">
          Período: {PERIODO_CONFIG[periodo].label}. O Noryos registra solicitação, envio e clique — não é possível confirmar avaliação
          publicada no Google sem uma integração própria.
        </p>
      </div>
    </main>
  );
}
