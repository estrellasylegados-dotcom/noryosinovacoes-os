import Link from "next/link";
import { redirect } from "next/navigation";
import { buscarClinicaAtual, getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { can } from "@/lib/autorizacao";
import { listarNovosPacientes, inicioPeriodo, isPeriodoValido, PERIODO_CONFIG, type PeriodoRelatorio } from "@/lib/relatorios";
import { montarRelatorioMarketing } from "@/lib/campanha-metricas";
import { listarAtendentes } from "@/lib/atendentes";
import { buscarPainelNps } from "@/lib/nps";
import { buscarIndicadores } from "@/lib/indicadores";
import { formatDataHora, formatTelefone } from "@/lib/tempo";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { AbasRelatorio } from "@/components/relatorios/AbasRelatorio";
import { RelatorioMarketing } from "@/components/campanhas/RelatorioMarketing";
import { RelatorioNps } from "@/components/relatorios/RelatorioNps";
import { FiltrosIndicadores } from "@/components/indicadores/FiltrosIndicadores";
import { PainelIndicadores } from "@/components/indicadores/PainelIndicadores";

export const dynamic = "force-dynamic";

export default async function ResumoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; responsavel?: string; canal?: string }>;
}) {
  const [sessao, clinicaId, params] = await Promise.all([getSessaoAtual(), getClinicaId(), searchParams]);

  if (!sessao || !can(sessao, "relatorios.visualizar")) redirect("/");

  if (!clinicaId) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">Não consegui conectar ao banco do CRM. Confira as variáveis de ambiente do Supabase.</p>
      </main>
    );
  }

  const periodo: PeriodoRelatorio = params.periodo && isPeriodoValido(params.periodo) ? params.periodo : "7d";
  const agora = new Date();
  const inicio = inicioPeriodo(periodo, agora);
  const filtros = {
    inicio,
    fim: agora,
    responsavelId: params.responsavel || undefined,
    canalId: params.canal || undefined,
  };

  const [indicadores, marketing, atendentes, clinicaAtual, painelNps, contatos] = await Promise.all([
    buscarIndicadores(clinicaId, filtros, agora),
    montarRelatorioMarketing(clinicaId, { inicio, fim: agora }),
    listarAtendentes(clinicaId),
    buscarClinicaAtual(),
    buscarPainelNps(clinicaId, { inicio, fim: agora }),
    listarNovosPacientes(clinicaId, periodo, agora),
  ]);

  if (!indicadores) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">Não consegui montar os indicadores agora. Nenhum dado foi alterado; tente novamente em instantes.</p>
      </main>
    );
  }

  const nomesAtendentes = Object.fromEntries(atendentes.map((a) => [a.id, a.nome]));
  const extrasPeriodo = { responsavel: params.responsavel ?? "", canal: params.canal ?? "" };

  return (
    <main className="px-4 py-7 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Gestão comercial e operacional</p>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">Indicadores</h1>
            <p className="mt-1 text-sm text-neutral-500">{clinicaAtual?.nome ?? "Clínica"} · visão do funil e do atendimento</p>
          </div>
          <FiltroPeriodo ativo={periodo} paramsExtras={extrasPeriodo} />
        </header>

        <div className="mb-6">
          <FiltrosIndicadores
            periodo={periodo}
            responsavel={params.responsavel}
            canal={params.canal}
            atendentes={indicadores.opcoes.atendentes}
            canais={indicadores.opcoes.canais}
          />
        </div>

        <AbasRelatorio
          abas={[
            {
              valor: "comercial-operacional",
              label: "Comercial e operação",
              conteudo: <PainelIndicadores dados={indicadores} />,
            },
            {
              valor: "marketing",
              label: "Marketing",
              conteudo: <RelatorioMarketing linhas={marketing} nomesAtendentes={nomesAtendentes} />,
            },
            {
              valor: "pesquisas",
              label: "Pesquisas",
              conteudo: <RelatorioNps painel={painelNps} />,
            },
            {
              valor: "contatos",
              label: "Novos contatos",
              conteudo: (
                <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                  {contatos.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-neutral-400">Nenhum contato novo {PERIODO_CONFIG[periodo].label.toLowerCase()}.</p>
                  ) : (
                    <ul className="divide-y divide-neutral-100">
                      {contatos.map((contato) => (
                        <li key={contato.id} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div className="min-w-0">
                            <Link href={`/pacientes/${contato.id}`} className="truncate text-sm font-medium text-neutral-900 hover:underline">
                              {contato.nome || formatTelefone(contato.telefone)}
                            </Link>
                            <p className="text-xs text-neutral-500">{formatTelefone(contato.telefone)}</p>
                          </div>
                          <span className="shrink-0 text-xs text-neutral-400">{formatDataHora(contato.criadoEm)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </main>
  );
}
