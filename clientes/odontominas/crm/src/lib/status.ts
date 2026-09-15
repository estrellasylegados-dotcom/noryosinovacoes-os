export type StatusConversa = "novo" | "aguardando" | "respondido" | "agendado" | "perdido";

/** Ordem de prioridade no painel: quem precisa de ação primeiro vem primeiro. */
export const STATUS_ORDEM: StatusConversa[] = [
  "novo",
  "aguardando",
  "respondido",
  "agendado",
  "perdido",
];

export const STATUS_CONFIG: Record<StatusConversa, { label: string; corBadge: string; corPonto: string }> = {
  novo: {
    label: "Novo",
    corBadge: "bg-red-50 text-red-700 ring-red-600/20",
    corPonto: "bg-red-500",
  },
  aguardando: {
    label: "Aguardando",
    corBadge: "bg-amber-50 text-amber-700 ring-amber-600/20",
    corPonto: "bg-amber-500",
  },
  respondido: {
    label: "Respondido",
    corBadge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    corPonto: "bg-emerald-500",
  },
  agendado: {
    label: "Agendado",
    corBadge: "bg-teal-50 text-teal-700 ring-teal-600/20",
    corPonto: "bg-teal-500",
  },
  perdido: {
    label: "Perdido",
    corBadge: "bg-neutral-100 text-neutral-500 ring-neutral-500/20",
    corPonto: "bg-neutral-400",
  },
};

export function isStatusValido(valor: string): valor is StatusConversa {
  return (STATUS_ORDEM as string[]).includes(valor);
}

/**
 * Status que tratam a conversa como encerrada (respondida, marcada com
 * consulta ou dada como perdida). Usado pra decidir quando uma mensagem
 * nova do paciente reabre o ciclo de atendimento — ver src/lib/funil.ts.
 */
export const STATUS_RESOLVIDOS: StatusConversa[] = ["respondido", "agendado", "perdido"];
