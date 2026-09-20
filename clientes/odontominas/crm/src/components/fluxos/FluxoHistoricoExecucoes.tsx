import { formatDataHora } from "@/lib/tempo";
import type { ExecucaoFluxoResumo } from "@/lib/fluxo-execucoes-consulta";

const ESTADOS: Record<string, string> = {
  queued: "Na fila",
  running: "Em execução",
  waiting_time: "Aguardando horário",
  waiting_input: "Aguardando resposta",
  completed: "Concluída",
  cancelled: "Interrompida",
  failed: "Falhou",
  transferred: "Transferida",
};

export function FluxoHistoricoExecucoes({ execucoes }: { execucoes: ExecucaoFluxoResumo[] }) {
  return (
    <section className="border-b border-neutral-200 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Execuções recentes</p>
      {execucoes.length === 0 ? <p className="mt-2 text-xs text-neutral-500">Nenhuma execução real registrada.</p> : (
        <ul className="mt-2 space-y-2">
          {execucoes.map((execucao) => (
            <li key={execucao.id} className="rounded-lg border border-neutral-200 p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-neutral-700">{ESTADOS[execucao.estado] ?? execucao.estado}</span>
                <span className="text-neutral-400">{formatDataHora(execucao.createdAt)}</span>
              </div>
              {execucao.oportunidadeId && <p className="mt-1 truncate text-neutral-500">Oportunidade: {execucao.oportunidadeId}</p>}
              {execucao.aguardandoAte && ["queued", "waiting_time", "waiting_input"].includes(execucao.estado) && (
                <p className="mt-1 text-neutral-500">Próxima verificação: {formatDataHora(execucao.aguardandoAte)}</p>
              )}
              {execucao.erro && <p className="mt-1 text-red-600">Erro: {execucao.erro}</p>}
              {execucao.motivoFinalizacao && !execucao.erro && <p className="mt-1 text-neutral-500">Motivo: {execucao.motivoFinalizacao}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
