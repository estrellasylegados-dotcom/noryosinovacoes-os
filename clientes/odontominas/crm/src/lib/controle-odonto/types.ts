/**
 * Tipos compartilhados do conector ControleODONTO. Nenhum campo aqui reflete
 * um contrato de payload real confirmado — só o que as capabilities e a
 * orquestração de sync exigem pra existir. Ver docs/integrations/controle-odonto.md
 * pra o que é confirmado vs. pendente antes de assumir qualquer formato.
 */

export type ControleOdontoEntityType = "paciente" | "consulta" | "profissional" | "estabelecimento";

export type MappedAppointmentStatus =
  | "agendado"
  | "confirmado"
  | "realizado"
  | "cancelado"
  | "faltou"
  | "unknown_external_status";

export type IntegrationHealth = "saudavel" | "degradada" | "indisponivel" | "nao_configurada";

/** DTO genérico e decoupled do formato de payload real — mapper.ts é o único lugar que precisa mudar quando o contrato chegar. */
export interface ExternalAppointmentDTO {
  externalId: string;
  establishmentExternalId: string | null;
  professionalExternalId: string | null;
  patientExternalId: string | null;
  patientPhone: string | null;
  startAt: string | null;
  endAt: string | null;
  status: MappedAppointmentStatus;
  rawStatus: string | null;
}
