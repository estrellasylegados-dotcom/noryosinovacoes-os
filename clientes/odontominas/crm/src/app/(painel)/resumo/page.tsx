import Link from "next/link";
import { redirect } from "next/navigation";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { buscarResumoExecutivo } from "@/lib/resumo";
import { buscarStatsAtendentes } from "@/lib/equipe";
import { contarNaoLidas } from "@/lib/chat";
import {
  buscarRelatorioAtendimento,
  isPeriodoValido,
  listarNovosPacientes,
  PERIODO_CONFIG,
  type PeriodoRelatorio,
} from "@/lib/relatorios";
import { formatDataHora, formatDuracao, formatTelefone } from "@/lib/tempo";
import { FiltroPeriodo } from "@/components/FiltroPeriodo";
import { AbasRelatorio } from "@/components/relatorios/AbasRelatorio";
import { BarChart, COR_SERIE_A, COR_SERIE_B } from "@/components/relatorios/BarChart";
import { montarRelatorioMarketing } from "@/lib/campanha-metricas";
import { listarAtendentes } from "@/lib/atendentes";
import { inicioPeriodo } from "@/lib/relatorios";
import { RelatorioMarketing } from "@/components/campanhas/RelatorioMarketing";

export const dynamic = "force-dynamic";

/**
 * Relatórios (2026-09-15, redesenhado no estilo "Painel Principal" da
 * RoiZap, a pedido do Rafael) — reúne o que era "Resumo Executivo" (visão
 * de funil, ainda sobre o estado atual) com séries por período (novos
 * pacientes, mensagens, horário de pico) e a Equipe (antes uma página à
 * parte, agora uma aba aqui — /equipe continua existindo, só saiu do menu).
 * Só admin — mesmo gate de sempre, redirect real, não só esconder o link.
 */
export default async function ResumoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const [sessao, clinicaId, { periodo: periodoBruto }] = await Promise.all([
    getSessaoAtual(),
    getClinicaId(),
    searchParams,
  ]);

  if (sessao?.papel !== "admin") {
    redirect("/");
  }

  if (!clinicaId) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">
          Não consegui conectar ao banco do CRM. Confira as variáveis de ambiente do Supabase.
        </p>
      </main>
    );
  }

  const periodo: PeriodoRelatorio = periodoBruto && isPeriodoValido(periodoBruto) ? periodoBruto : "7d";

  const agora = new Date();
  const [resumo, relatorio, leads, statsAtendentes, naoLidas, marketing, atendentes] = await Promise.all([
    buscarResumoExecutivo(clinicaId),
    buscarRelatorioAtendimento(clinicaId, periodo),
    listarNovosPacientes(clinicaId, periodo),
    buscarStatsAtendentes(clinicaId),
    contarNaoLidas(clinicaId),
    montarRelatorioMarketing(clinicaId, { inicio: inicioPeriodo(periodo, agora), fim: agora }),
    listarAtendentes(clinicaId),
  ]);
  const nomesAtendentes = Object.fromEntries(atendentes.map((a) => [a.id, a.nome]));

  const semResposta = resumo.contagens.novo + resumo.contagens.aguardando;
  const resolvidas = resumo.contagens.respondido + resumo.contagens.agendado;
  const taxaResolucaoPct = resumo.total > 0 ? Math.round((resolvidas / resumo.total) * 100) : null;

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Relatórios</h1>
            <p className="text-sm text-neutral-500">OdontoMinas — desempenho de atendimento</p>
          </div>
          <FiltroPeriodo ativo={periodo} />
        </header>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card label="Novos pacientes" valor={relatorio.novosPacientes} legenda={PERIODO_CONFIG[periodo].label} />
          <Card
            label="Conversas ativas"
            valor={relatorio.conversasAtivas}
            legenda={`de ${relatorio.conversasTocadas} tocadas no período`}
          />
          <Card
            label="Mensagens enviadas"
            valor={relatorio.mensagensEnviadas}
            legenda={`${relatorio.mensagensRecebidas} recebidas`}
          />
          <Card label="Aguardando resposta" valor={naoLidas} legenda="conversas não lidas" destaque={naoLidas > 0} />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card
            label="Tempo médio até 1ª resposta"
            valor={resumo.tempoMedioRespostaMs === null ? "—" : formatDuracao(resumo.tempoMedioRespostaMs)}
            legenda="sobre o funil inteiro"
          />
          <Card label="Sem resposta" valor={semResposta} legenda="conversas aguardando, agora" destaque={semResposta > 0} />
          <Card
            label="Taxa de resolução"
            valor={taxaResolucaoPct === null ? "—" : `${taxaResolucaoPct}%`}
            legenda="sobre o funil inteiro"
          />
        </div>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-neutral-700">Leads esfriando (esperando há mais de 30min)</h2>
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {resumo.leadsEsfriando.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-400">Nenhum lead esfriando agora.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {resumo.leadsEsfriando.map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-4 py-3">
                    {c.pacienteId ? (
                      <Link href={`/pacientes/${c.pacienteId}`} className="text-sm font-medium text-neutral-900 hover:underline">
                        {c.pacienteNome || formatTelefone(c.telefone)}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-neutral-900">
                        {c.pacienteNome || formatTelefone(c.telefone)}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-red-600">
                      esperando há {formatDuracao(c.tempoPrimeiraRespostaMs ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <AbasRelatorio
          abas={[
            {
              valor: "visao-geral",
              label: "Visão Geral",
              conteudo: (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <BarChart
                    titulo="Novos pacientes por dia"
                    categorias={relatorio.porDia.map((p) => p.label)}
                    series={[{ label: "Pacientes", cor: COR_SERIE_A, valores: relatorio.porDia.map((p) => p.novosPacientes) }]}
                  />
                  <BarChart
                    titulo="Mensagens enviadas vs. recebidas"
                    categorias={relatorio.porDia.map((p) => p.label)}
                    series={[
                      { label: "Enviadas", cor: COR_SERIE_A, valores: relatorio.porDia.map((p) => p.enviadas) },
                      { label: "Recebidas", cor: COR_SERIE_B, valores: relatorio.porDia.map((p) => p.recebidas) },
                    ]}
                  />
                  <BarChart
                    titulo="Horários de pico"
                    categorias={relatorio.porHora.map((p) => p.label)}
                    series={[
                      { label: "Enviadas", cor: COR_SERIE_A, valores: relatorio.porHora.map((p) => p.enviadas) },
                      { label: "Recebidas", cor: COR_SERIE_B, valores: relatorio.porHora.map((p) => p.recebidas) },
                    ]}
                  />
                  <BarChart
                    titulo="Conversas abertas vs. concluídas"
                    categorias={relatorio.porDia.map((p) => p.label)}
                    series={[
                      { label: "Abertas", cor: COR_SERIE_A, valores: relatorio.porDia.map((p) => p.abertas) },
                      { label: "Concluídas", cor: COR_SERIE_B, valores: relatorio.porDia.map((p) => p.fechadas) },
                    ]}
                  />
                </div>
              ),
            },
            {
              valor: "equipe",
              label: "Equipe",
              conteudo:
                statsAtendentes.length === 0 ? (
                  <p className="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-400">
                    Nenhum atendente cadastrado ainda.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {statsAtendentes.map((a) => (
                      <div key={a.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-neutral-900">{a.nome}</p>
                            <p className="text-xs capitalize text-neutral-400">{a.papel}</p>
                          </div>
                          {!a.ativo && (
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                              Inativa
                            </span>
                          )}
                        </div>
                        <dl className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <dt className="text-xs text-neutral-500">Hoje</dt>
                            <dd className="text-lg font-semibold text-neutral-900">{a.atendimentosHoje}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-neutral-500">No total</dt>
                            <dd className="text-lg font-semibold text-neutral-900">{a.conversasAtendidas}</dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-xs text-neutral-500">Tempo médio até responder</dt>
                            <dd className="font-medium text-neutral-900">
                              {a.tempoMedioRespostaMs === null ? "—" : formatDuracao(a.tempoMedioRespostaMs)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    ))}
                  </div>
                ),
            },
            {
              valor: "marketing",
              label: "Marketing",
              conteudo: <RelatorioMarketing linhas={marketing} nomesAtendentes={nomesAtendentes} />,
            },
            {
              valor: "leads",
              label: "Leads",
              conteudo: (
                <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                  {leads.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-neutral-400">
                      Nenhum paciente novo {PERIODO_CONFIG[periodo].label.toLowerCase()}.
                    </p>
                  ) : (
                    <ul className="divide-y divide-neutral-100">
                      {leads.map((lead) => (
                        <li key={lead.id} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <Link href={`/pacientes/${lead.id}`} className="text-sm font-medium text-neutral-900 hover:underline">
                              {lead.nome || formatTelefone(lead.telefone)}
                            </Link>
                            <p className="text-xs text-neutral-500">{formatTelefone(lead.telefone)}</p>
                          </div>
                          <span className="text-xs text-neutral-400">{formatDataHora(lead.criadoEm)}</span>
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

function Card({
  label,
  valor,
  legenda,
  destaque,
}: {
  label: string;
  valor: number | string;
  legenda: string;
  destaque?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${destaque ? "border-red-300" : "border-neutral-200"}`}>
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${destaque ? "text-red-600" : "text-neutral-900"}`}>{valor}</p>
      <p className="mt-0.5 text-xs text-neutral-400">{legenda}</p>
    </div>
  );
}
