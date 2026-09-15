import { contarPorStatus, listarConversas, type ConversaPainel } from "@/lib/conversas";
import { LIMITE_ESPERA_MS, type StatusConversa } from "@/lib/status";

export type ResumoExecutivo = {
  contagens: Record<StatusConversa, number>;
  total: number;
  /** Média só entre conversas que de fato receberam 1ª resposta — em aberto não conta. */
  tempoMedioRespostaMs: number | null;
  /** Em aberto (novo/aguardando) há mais que LIMITE_ESPERA_MS, da espera mais longa pra mais curta. */
  leadsEsfriando: ConversaPainel[];
};

export function calcularResumo(
  conversas: ConversaPainel[],
  contagens: Record<StatusConversa, number>
): Omit<ResumoExecutivo, "contagens"> {
  const total = Object.values(contagens).reduce((a, b) => a + b, 0);

  const respondidos = conversas.filter(
    (c) => c.tempoPrimeiraRespostaMs !== null && (c.status === "respondido" || c.status === "agendado")
  );
  const tempoMedioRespostaMs =
    respondidos.length > 0
      ? Math.round(respondidos.reduce((soma, c) => soma + (c.tempoPrimeiraRespostaMs ?? 0), 0) / respondidos.length)
      : null;

  const leadsEsfriando = conversas
    .filter(
      (c) =>
        (c.status === "novo" || c.status === "aguardando") && (c.tempoPrimeiraRespostaMs ?? 0) > LIMITE_ESPERA_MS
    )
    .sort((a, b) => (b.tempoPrimeiraRespostaMs ?? 0) - (a.tempoPrimeiraRespostaMs ?? 0));

  return { total, tempoMedioRespostaMs, leadsEsfriando };
}

export async function buscarResumoExecutivo(clinicaId: string): Promise<ResumoExecutivo> {
  const [contagens, conversas] = await Promise.all([contarPorStatus(clinicaId), listarConversas(clinicaId)]);
  return { contagens, ...calcularResumo(conversas, contagens) };
}
