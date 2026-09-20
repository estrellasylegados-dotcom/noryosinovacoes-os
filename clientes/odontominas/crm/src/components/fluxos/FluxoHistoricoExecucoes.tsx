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

const MOTIVOS: Record<string, string> = {
  interrompida_manualmente: "Interrompida ao pausar a automação",
  etapa_alterada: "A oportunidade mudou de etapa",
  oportunidade_encerrada: "A oportunidade foi convertida ou perdida",
  paciente_respondeu: "O paciente respondeu",
  intervencao_humana: "A equipe assumiu o atendimento",
  opt_out: "O paciente não deseja receber mensagens",
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
              {execucao.oportunidadeId && (
                <details className="mt-1 text-neutral-500">
                  <summary className="cursor-pointer">Oportunidade vinculada</summary>
                  <code className="mt-1 block break-all text-[10px] text-neutral-400">{execucao.oportunidadeId}</code>
                </details>
              )}
              {execucao.aguardandoAte && ["queued", "waiting_time", "waiting_input"].includes(execucao.estado) && (
                <p className="mt-1 text-neutral-500">Próxima verificação: {formatDataHora(execucao.aguardandoAte)}</p>
              )}
              {execucao.erro && <p className="mt-1 text-red-600">Erro: {execucao.erro}</p>}
              {execucao.motivoFinalizacao && !execucao.erro && (
                <p className="mt-1 text-neutral-500">Motivo: {MOTIVOS[execucao.motivoFinalizacao] ?? "A execução foi encerrada pelo sistema"}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
