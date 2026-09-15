export type Prioridade = "urgente" | "alta" | "normal" | "baixa";

/** Ordem de exibição no filtro do Chat ao Vivo: quem precisa de atenção primeiro vem primeiro. */
export const PRIORIDADE_ORDEM: Prioridade[] = ["urgente", "alta", "normal", "baixa"];

export const PRIORIDADE_CONFIG: Record<Prioridade, { label: string; corBadge: string; corPonto: string }> = {
  urgente: {
    label: "Urgente",
    corBadge: "bg-red-50 text-red-700 ring-red-600/20",
    corPonto: "bg-red-500",
  },
  alta: {
    label: "Alta",
    corBadge: "bg-orange-50 text-orange-700 ring-orange-600/20",
    corPonto: "bg-orange-500",
  },
  normal: {
    label: "Normal",
    corBadge: "bg-blue-50 text-blue-700 ring-blue-600/20",
    corPonto: "bg-blue-500",
  },
  baixa: {
    label: "Baixa",
    corBadge: "bg-neutral-100 text-neutral-500 ring-neutral-500/20",
    corPonto: "bg-neutral-400",
  },
};

export function isPrioridadeValida(valor: string): valor is Prioridade {
  return (PRIORIDADE_ORDEM as string[]).includes(valor);
}
