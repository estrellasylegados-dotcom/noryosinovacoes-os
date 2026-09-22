import type { PainelExperiencia } from "@/lib/reputacao-metricas";
import { formatPercentual } from "@/lib/tempo";

export function RelatorioExperiencia({ painel }: { painel: PainelExperiencia }) {
  const duracao = (minutos: number | null) => minutos === null ? "—" : minutos < 60 ? `${Math.round(minutos)} min` : `${(minutos / 60).toFixed(1)} h`;
  const itens = [
    ["Pesquisas enviadas", painel.pesquisasEnviadas], ["Respostas", painel.respostas], ["Participação", painel.taxaParticipacao === null ? "—" : formatPercentual(painel.taxaParticipacao)],
    ["Muito boa", painel.muitoBoa], ["Boa", painel.boa], ["Poderia melhorar", painel.poderiaMelhorar],
    ["Casos abertos", painel.casosAbertos], ["Em tratativa", painel.casosEmTratativa], ["Resolvidos", painel.casosResolvidos],
    ["1ª tratativa média", duracao(painel.mediaPrimeiraTratativaMinutos)], ["Resolução média", duracao(painel.mediaResolucaoMinutos)],
  ];
  return <section><h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Experiência do paciente e recuperação</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{itens.map(([titulo, valor]) => <div key={titulo} className="rounded-xl border border-neutral-200 bg-white p-3"><p className="text-xs text-neutral-500">{titulo}</p><p className="text-lg font-semibold text-neutral-900">{valor}</p></div>)}</div></section>;
}
