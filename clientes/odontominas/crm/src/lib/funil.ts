import { STATUS_RESOLVIDOS, type StatusConversa } from "@/lib/status";

/**
 * Regra de negócio do funil de atendimento, extraída do webhook pra ficar
 * testável isolada (sem precisar simular o Supabase).
 *
 * Duas transições automáticas:
 * - 1ª mensagem da clínica numa conversa "novo" → "respondido" (like já
 *   existia desde a Fase 2).
 * - Mensagem nova do paciente numa conversa já resolvida (respondido,
 *   agendado ou perdido) → reabre pra "novo". Sem isso, um paciente que
 *   volta a escrever depois de já ter sido atendido (ou até depois de
 *   marcado como perdido) some do radar do painel: o status nunca mais
 *   muda sozinho, e a mensagem só aparece se alguém abrir aquela conversa
 *   por acaso.
 */

export type DecisaoTransicao = {
  statusNovo: StatusConversa;
  /** true quando a mensagem reabriu um ciclo encerrado — reinicia o relógio de espera. */
  reabriu: boolean;
  evento: { statusAnterior: StatusConversa; statusNovo: StatusConversa; motivo: string } | null;
};

export function decidirTransicaoWebhook(statusAtual: StatusConversa, fromMe: boolean): DecisaoTransicao {
  if (fromMe) {
    if (statusAtual === "novo") {
      return {
        statusNovo: "respondido",
        reabriu: false,
        evento: { statusAnterior: "novo", statusNovo: "respondido", motivo: "primeira_resposta_automatica" },
      };
    }
    return { statusNovo: statusAtual, reabriu: false, evento: null };
  }

  if (STATUS_RESOLVIDOS.includes(statusAtual)) {
    return {
      statusNovo: "novo",
      reabriu: true,
      evento: { statusAnterior: statusAtual, statusNovo: "novo", motivo: "nova_mensagem_reabriu" },
    };
  }

  return { statusNovo: statusAtual, reabriu: false, evento: null };
}
