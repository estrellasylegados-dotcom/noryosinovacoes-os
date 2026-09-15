export function formatDuracao(ms: number): string {
  const total = Math.max(0, ms);
  const min = Math.floor(total / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;

  const h = Math.floor(min / 60);
  const remMin = min % 60;
  if (h < 24) return remMin > 0 ? `${h}h${remMin}min` : `${h}h`;

  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH > 0 ? `${d}d${remH}h` : `${d}d`;
}

export function formatDataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Aceita telefone com ou sem DDI 55; cai no valor cru se não bater um formato BR conhecido. */
export function formatTelefone(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  const semDDI = digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;

  if (semDDI.length === 11) {
    return `(${semDDI.slice(0, 2)}) ${semDDI.slice(2, 7)}-${semDDI.slice(7)}`;
  }
  if (semDDI.length === 10) {
    return `(${semDDI.slice(0, 2)}) ${semDDI.slice(2, 6)}-${semDDI.slice(6)}`;
  }
  return telefone;
}
