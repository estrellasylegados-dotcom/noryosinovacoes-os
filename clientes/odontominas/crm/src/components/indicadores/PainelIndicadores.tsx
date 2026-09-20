import Link from "next/link";
import type { IndicadoresDashboard } from "@/lib/indicadores";
import { BarChart, COR_SERIE_A, COR_SERIE_B } from "@/components/relatorios/BarChart";

const numero = new Intl.NumberFormat("pt-BR");

function formatarMinutos(valor: number | null): string {
  if (valor === null) return "—";
  if (valor < 60) return `${Math.round(valor)} min`;
  const horas = Math.floor(valor / 60);
  const minutos = Math.round(valor % 60);
  return minutos ? `${horas}h ${minutos}min` : `${horas}h`;
}

function Kpi({ titulo, valor, apoio, tom = "neutro" }: { titulo: string; valor: string | number; apoio: string; tom?: "neutro" | "positivo" | "atencao" | "critico" }) {
  const cores = {
    neutro: "border-neutral-200 bg-white text-neutral-950",
    positivo: "border-emerald-200 bg-emerald-50/60 text-emerald-900",
    atencao: "border-amber-200 bg-amber-50/60 text-amber-900",
    critico: "border-red-200 bg-red-50/60 text-red-900",
  };
  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${cores[tom]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] opacity-65">{titulo}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{valor}</p>
      <p className="mt-1 text-xs opacity-60">{apoio}</p>
    </article>
  );
}

function Secao({ titulo, descricao, children }: { titulo: string; descricao: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <header className="mb-5">
        <h2 className="text-base font-semibold text-neutral-950">{titulo}</h2>
        <p className="mt-1 text-sm text-neutral-500">{descricao}</p>
      </header>
      {children}
    </section>
  );
}

function MetricaCompacta({ label, valor, detalhe }: { label: string; valor: string | number; detalhe?: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-4 py-3">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-neutral-900">{valor}</dd>
      {detalhe && <p className="mt-0.5 text-[11px] text-neutral-400">{detalhe}</p>}
    </div>
  );
}

export function PainelIndicadores({ dados }: { dados: IndicadoresDashboard }) {
  const maiorEtapa = Math.max(1, ...dados.funil.map((e) => e.quantidade));
  const coberturaPct = dados.origem.total > 0 ? Math.round((dados.origem.cobertura / dados.origem.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {(dados.qualidade.oportunidadesDemonstracao > 0 || !dados.qualidade.horarioConfigurado) && (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Leitura com contexto de demonstração</p>
            <p className="mt-0.5 text-xs text-amber-800">
              {dados.qualidade.oportunidadesDemonstracao > 0 && `${dados.qualidade.oportunidadesDemonstracao} oportunidade(s) de demonstração estão incluídas. `}
              {!dados.qualidade.horarioConfigurado && "A primeira resposta usa tempo corrido; a conformidade do SLA fica indisponível até o horário da clínica ser configurado."}
            </p>
          </div>
          {!dados.qualidade.horarioConfigurado && (
            <Link href="/configuracoes/horario" className="shrink-0 text-xs font-semibold underline underline-offset-2">
              Configurar horário
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Oportunidades" valor={numero.format(dados.kpis.oportunidades)} apoio="criadas no período" />
        <Kpi titulo="Avançaram" valor={numero.format(dados.kpis.avancaram)} apoio="mudaram de etapa no período" tom="positivo" />
        <Kpi titulo="Em aberto" valor={numero.format(dados.kpis.abertas)} apoio="da coorte selecionada" tom={dados.kpis.abertas > 0 ? "atencao" : "neutro"} />
        <Kpi titulo="Agendadas" valor={numero.format(dados.kpis.agendadas)} apoio="entraram em Agendado" tom="positivo" />
        <Kpi titulo="Convertidas" valor={numero.format(dados.kpis.convertidas)} apoio="fechadas com ganho" tom="positivo" />
        <Kpi titulo="Perdidas" valor={numero.format(dados.kpis.perdidas)} apoio="fechadas com perda" tom={dados.kpis.perdidas > 0 ? "critico" : "neutro"} />
        <Kpi titulo="Taxa de fechamento" valor={dados.kpis.taxaFechamento === null ? "—" : `${dados.kpis.taxaFechamento}%`} apoio="ganhas entre as encerradas" />
        <Kpi titulo="Sem responsável" valor={numero.format(dados.atendimento.semResponsavel)} apoio="conversas abertas agora" tom={dados.atendimento.semResponsavel > 0 ? "critico" : "positivo"} />
      </div>

      <BarChart
        titulo="Entradas x conversões ao longo do período"
        categorias={dados.tendencia.categorias}
        series={[
          { label: "Oportunidades", cor: COR_SERIE_A, valores: dados.tendencia.oportunidades },
          { label: "Convertidas", cor: COR_SERIE_B, valores: dados.tendencia.convertidas },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Secao titulo="Funil comercial" descricao="Etapa atual das oportunidades criadas no período. A sinalização de parada usa as regras existentes da Central de Alertas.">
          <div className="space-y-4">
            {dados.funil.map((etapa) => {
              const largura = etapa.quantidade === 0 ? 0 : Math.max(6, Math.round((etapa.quantidade / maiorEtapa) * 100));
              return (
                <div key={etapa.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: etapa.cor ?? "#0f766e" }} />
                      <span className="truncate font-medium text-neutral-800">{etapa.nome}</span>
                      {etapa.paradas > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          {etapa.paradas} parada{etapa.paradas === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold tabular-nums text-neutral-900">{etapa.quantidade}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full transition-[width]" style={{ width: `${largura}%`, backgroundColor: etapa.cor ?? "#0f766e" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Secao>

        <Secao titulo="Atendimento" descricao="Volume recebido no período e situação operacional da fila agora.">
          <dl className="grid grid-cols-2 gap-3">
            <MetricaCompacta label="Conversas recebidas" valor={dados.atendimento.conversasRecebidas} />
            <MetricaCompacta label="Com resposta humana" valor={dados.atendimento.conversasAtendidas} />
            <MetricaCompacta
              label="1ª resposta média"
              valor={formatarMinutos(dados.atendimento.primeiraRespostaMediaMinutos)}
              detalhe={dados.atendimento.amostrasPrimeiraResposta ? `${dados.atendimento.amostrasPrimeiraResposta} amostra(s) · ${dados.atendimento.primeiraRespostaModo === "horario_util" ? "horário útil" : "tempo corrido"}` : "sem amostra confiável"}
            />
            <MetricaCompacta label="Mediana" valor={formatarMinutos(dados.atendimento.primeiraRespostaMedianaMinutos)} />
          </dl>
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">SLA da fila atual</p>
              <span className="text-sm font-semibold text-neutral-900">
                {dados.atendimento.slaDisponivel && dados.atendimento.slaDentroPercentual !== null ? `${dados.atendimento.slaDentroPercentual}% dentro` : "Indisponível"}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg bg-emerald-50 p-2"><p className="text-lg font-semibold text-emerald-800">{dados.atendimento.slaDentro}</p><p className="text-[10px] text-emerald-700">Dentro</p></div>
              <div className="rounded-lg bg-amber-50 p-2"><p className="text-lg font-semibold text-amber-800">{dados.atendimento.slaAtencao}</p><p className="text-[10px] text-amber-700">Atenção</p></div>
              <div className="rounded-lg bg-red-50 p-2"><p className="text-lg font-semibold text-red-800">{dados.atendimento.slaEstourado}</p><p className="text-[10px] text-red-700">Estourado</p></div>
              <div className="rounded-lg bg-neutral-100 p-2"><p className="text-lg font-semibold text-neutral-700">{dados.atendimento.slaPausado}</p><p className="text-[10px] text-neutral-500">Pausado</p></div>
            </div>
          </div>
        </Secao>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Secao titulo="Resultado por canal" descricao="Oportunidades criadas no período, ligadas ao canal da conversa de entrada.">
          {dados.canais.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">Nenhuma oportunidade com canal neste período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-100 text-xs uppercase tracking-wide text-neutral-400">
                  <tr><th className="pb-2 font-medium">Canal</th><th className="pb-2 text-right font-medium">Entradas</th><th className="pb-2 text-right font-medium">Conversões</th><th className="pb-2 text-right font-medium">Taxa</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {dados.canais.map((canal) => (
                    <tr key={canal.id}>
                      <td className="py-3 font-medium text-neutral-800">{canal.nome}</td>
                      <td className="py-3 text-right tabular-nums text-neutral-600">{canal.oportunidades}</td>
                      <td className="py-3 text-right tabular-nums text-neutral-600">{canal.convertidas}</td>
                      <td className="py-3 text-right font-semibold tabular-nums text-neutral-900">{canal.taxaFechamento === null ? "—" : `${canal.taxaFechamento}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Secao>

        <Secao titulo="Origem das oportunidades" descricao="Cobertura do dado de aquisição; nenhuma origem é inferida quando o CRM não a recebeu.">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-semibold tracking-tight text-neutral-950">{coberturaPct}%</p>
              <p className="text-xs text-neutral-500">{dados.origem.cobertura} de {dados.origem.total} oportunidades identificadas</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${coberturaPct >= 70 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {coberturaPct >= 70 ? "Cobertura boa" : "Dados insuficientes"}
            </span>
          </div>
          {coberturaPct < 70 ? (
            <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">O gráfico por origem será útil quando campanhas, UTMs ou a origem do lead passarem a chegar de forma consistente.</p>
          ) : (
            <div className="space-y-2">
              {dados.origem.linhas.map((origem) => (
                <div key={origem.nome} className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-sm">
                  <span className="font-medium text-neutral-800">{origem.nome}</span>
                  <span className="text-neutral-500">{origem.oportunidades} entrada(s) · {origem.convertidas} conversão(ões)</span>
                </div>
              ))}
            </div>
          )}
        </Secao>
      </div>

      <Secao titulo="Desempenho da equipe" descricao="Visão de capacidade e resultado, sem ranking. Agendamentos e conversões são atribuídos a quem era responsável no momento do evento.">
        {dados.equipe.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">Nenhuma pessoa ativa encontrada para os filtros selecionados.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dados.equipe.map((pessoa) => (
              <article key={pessoa.id} className="rounded-2xl border border-neutral-200 p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div><h3 className="font-semibold text-neutral-900">{pessoa.nome}</h3><p className="text-xs capitalize text-neutral-400">{pessoa.perfil}</p></div>
                  {pessoa.slaEstourado > 0 && <span className="rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700">{pessoa.slaEstourado} SLA</span>}
                </div>
                <dl className="grid grid-cols-3 gap-x-3 gap-y-4">
                  <div><dt className="text-[11px] text-neutral-400">Oportunidades</dt><dd className="mt-0.5 text-lg font-semibold text-neutral-900">{pessoa.oportunidades}</dd></div>
                  <div><dt className="text-[11px] text-neutral-400">Abertas</dt><dd className="mt-0.5 text-lg font-semibold text-neutral-900">{pessoa.abertas}</dd></div>
                  <div><dt className="text-[11px] text-neutral-400">Conversas</dt><dd className="mt-0.5 text-lg font-semibold text-neutral-900">{pessoa.conversasEmAtendimento}</dd></div>
                  <div><dt className="text-[11px] text-neutral-400">Agendadas</dt><dd className="mt-0.5 text-lg font-semibold text-teal-800">{pessoa.agendamentos}</dd></div>
                  <div><dt className="text-[11px] text-neutral-400">Convertidas</dt><dd className="mt-0.5 text-lg font-semibold text-emerald-700">{pessoa.conversoes}</dd></div>
                  <div><dt className="text-[11px] text-neutral-400">1ª resposta</dt><dd className="mt-0.5 text-sm font-semibold text-neutral-900">{formatarMinutos(pessoa.primeiraRespostaMediaMinutos)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </Secao>
    </div>
  );
}
