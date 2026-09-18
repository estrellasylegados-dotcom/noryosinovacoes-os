import type { StatusSlaConversa } from "@/lib/sla";

const ROTULO_CICLO: Record<string, string> = {
  primeira_resposta: "Primeira resposta",
  resposta_atendimento: "Resposta em atendimento",
};

/** Ordem de risco — usada pra ordenar a lista por SLA (mais crítico primeiro). */
export function rankSla(status: StatusSlaConversa | undefined): number {
  if (!status) return 5;
  switch (status.tipo) {
    case "breached":
      return 0;
    case "warning":
      return 1;
    case "paused":
      return 2;
    case "ok":
      return 3;
    case "sem_ciclo":
    case "not_configured":
      return 4;
  }
}

/** 🟢/🟡/🔴/⏸ discreto, com tooltip nativo (title) — nunca poluir a tela com texto grande. */
export function SlaBadge({ status, compacto = false }: { status: StatusSlaConversa | undefined; compacto?: boolean }) {
  if (!status || status.tipo === "not_configured" || status.tipo === "sem_ciclo") return null;

  if (status.tipo === "paused") {
    return (
      <span title="Fora do horário de atendimento — SLA pausado" className="text-xs">
        ⏸{!compacto && <span className="ml-1 text-neutral-400">fora do expediente</span>}
      </span>
    );
  }

  const cor = status.tipo === "breached" ? "🔴" : status.tipo === "warning" ? "🟡" : "🟢";
  const titulo = `${ROTULO_CICLO[status.cicloTipo]}\nLimite: ${status.limiteMinutos} min úteis\nConsumido: ${status.minutosConsumidos} min\n${status.percentual}%`;

  return (
    <span title={titulo} className="whitespace-nowrap text-xs font-medium">
      {cor} {status.minutosConsumidos} min
    </span>
  );
}
