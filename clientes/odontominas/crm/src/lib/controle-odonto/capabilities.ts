import type { ControleOdontoConfig } from "./config";

/**
 * Nomes em inglês de propósito (contrato explícito pedido junto com esta
 * integração) — o resto do arquivo segue o idioma do projeto.
 */
export interface ControleOdontoCapabilities {
  canReadAppointments: boolean;
  canCreateAppointments: boolean;
  canUpdateAppointments: boolean;
  canCancelAppointments: boolean;
  canReadPatients: boolean;
  canCreatePatients: boolean;
  canReceiveWebhooks: boolean;
}

const NENHUMA_CAPABILITY: ControleOdontoCapabilities = {
  canReadAppointments: false,
  canCreateAppointments: false,
  canUpdateAppointments: false,
  canCancelAppointments: false,
  canReadPatients: false,
  canCreatePatients: false,
  canReceiveWebhooks: false,
};

/**
 * Cada capability só vira `true` manualmente, aqui, depois que alguém
 * validar de verdade contra a API real (endpoint + autenticação + payload +
 * comportamento confirmados — ver docs/integrations/controle-odonto.md,
 * checklist "Fase de Descoberta com Credencial"). Hoje nenhuma está
 * confirmada: a área pública de Webhooks/Autenticação do manual do
 * ControleODONTO está marcada "(FAZER)" (vazia, verificado em 2026-09-16) e
 * nenhuma URL base, mecanismo de autenticação ou payload foi validado
 * contra uma conta real.
 *
 * Isso é deliberado, não um bug: mesmo com `CONTROLE_ODONTO_ENABLED=true`,
 * nada liga sozinho por causa de env var — evita o pior cenário (chamar uma
 * API real assumindo um contrato inventado).
 */
const CAPABILITIES_CONFIRMADAS: ControleOdontoCapabilities = {
  canReadAppointments: false,
  canCreateAppointments: false,
  canUpdateAppointments: false,
  canCancelAppointments: false,
  canReadPatients: false,
  canCreatePatients: false,
  canReceiveWebhooks: false,
};

export function getControleOdontoCapabilities(config: ControleOdontoConfig): ControleOdontoCapabilities {
  if (!config.enabled) return NENHUMA_CAPABILITY;
  return { ...CAPABILITIES_CONFIRMADAS };
}
