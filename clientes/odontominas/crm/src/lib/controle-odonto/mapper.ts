import type { MappedAppointmentStatus } from "./types";

/**
 * Nenhum valor de status real do ControleODONTO foi confirmado
 * publicamente (ver docs/integrations/controle-odonto.md) — o mapa nasce
 * vazio de propósito. Preencher só depois de ver a API responder de
 * verdade com uma credencial real (checklist "Fase de Descoberta com
 * Credencial"). Até lá, todo status volta `unknown_external_status`, nunca
 * uma adivinhação silenciosa (ver pedido, seção STATUS).
 */
const MAPA_STATUS_CONFIRMADOS: Record<string, MappedAppointmentStatus> = {};

export function mapControleOdontoAppointmentStatus(statusBruto: string | null | undefined): MappedAppointmentStatus {
  if (!statusBruto) return "unknown_external_status";

  const normalizado = statusBruto.trim().toLowerCase();
  const mapeado = MAPA_STATUS_CONFIRMADOS[normalizado];

  if (!mapeado) {
    console.error("[controle-odonto/mapper] status_desconhecido", JSON.stringify({ statusBruto }));
    return "unknown_external_status";
  }

  return mapeado;
}
