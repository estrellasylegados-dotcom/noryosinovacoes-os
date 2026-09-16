/**
 * Preferência de notificação do navegador (Notification API), a pedido do
 * Rafael (referência: banner "Ative as notificações" da RoiZap) — resolve o
 * "não perder mensagem" de verdade, diferente do sino do topo (só conta
 * enquanto a aba está aberta e em foco). Preferência é por navegador/pessoa,
 * não por clínica — fica em localStorage, nunca no Supabase.
 *
 * Três posições (não um liga/desliga comum): aproveita as duas categorias
 * que src/lib/notificacoes.ts já distingue (mensagem não lida / lead
 * esfriando) em vez de inventar uma terceira coisa.
 */

export type PreferenciaNotificacao = "desligado" | "tudo" | "so_esfriando";

export const PREFERENCIAS_ORDEM: PreferenciaNotificacao[] = ["desligado", "tudo", "so_esfriando"];

export const PREFERENCIA_LABEL: Record<PreferenciaNotificacao, string> = {
  desligado: "Desligadas",
  tudo: "Todas",
  so_esfriando: "Só esfriando",
};

const CHAVE = "crm-notificacoes-preferencia";
const PADRAO: PreferenciaNotificacao = "tudo";

function isPreferenciaValida(valor: string | null): valor is PreferenciaNotificacao {
  return (PREFERENCIAS_ORDEM as string[]).includes(valor ?? "");
}

/** Lê a preferência salva neste navegador — `tudo` (padrão) se nunca foi escolhida ou se não há localStorage (SSR). */
export function lerPreferenciaNotificacao(): PreferenciaNotificacao {
  if (typeof window === "undefined") return PADRAO;
  try {
    const valor = window.localStorage.getItem(CHAVE);
    return isPreferenciaValida(valor) ? valor : PADRAO;
  } catch {
    return PADRAO;
  }
}

export function salvarPreferenciaNotificacao(pref: PreferenciaNotificacao): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, pref);
  } catch {
    // localStorage bloqueado (aba privada, política do navegador) — a preferência só não persiste entre sessões.
  }
}

/** Um alerta desse tipo deve virar notificação do navegador, dada a preferência escolhida? */
export function deveNotificar(tipo: "nao_lida" | "esfriando", pref: PreferenciaNotificacao): boolean {
  if (pref === "desligado") return false;
  if (pref === "so_esfriando") return tipo === "esfriando";
  return true;
}
