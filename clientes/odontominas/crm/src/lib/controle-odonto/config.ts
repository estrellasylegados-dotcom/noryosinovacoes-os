/**
 * Configuração da integração ControleODONTO — lida só de variáveis de
 * ambiente server-side (nunca `NEXT_PUBLIC_`). `enabled` exige base URL
 * preenchida: sem ela, não tem pra onde chamar, então a integração fica
 * "não configurada" mesmo que `CONTROLE_ODONTO_ENABLED=true` esteja setado
 * por engano.
 */

export const VERSAO_CONECTOR_CONTROLE_ODONTO = "0.1.0-preparado";

export interface ControleOdontoConfig {
  enabled: boolean;
  baseUrl: string | null;
  estabelecimentoId: string | null;
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  syncMargemHoras: number;
  syncHorizonteDias: number;
}

const PADRAO_SYNC_INTERVAL_MINUTES = 5;
const PADRAO_SYNC_MARGEM_HORAS = 24;
const PADRAO_SYNC_HORIZONTE_DIAS = 30;

function lerInteiroPositivo(valor: string | undefined, padrao: number): number {
  if (!valor) return padrao;
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) && n > 0 ? n : padrao;
}

export function getControleOdontoConfig(): ControleOdontoConfig {
  const baseUrl = process.env.CONTROLE_ODONTO_BASE_URL?.trim() || null;
  const enabled = process.env.CONTROLE_ODONTO_ENABLED === "true" && Boolean(baseUrl);

  return {
    enabled,
    baseUrl,
    estabelecimentoId: process.env.CONTROLE_ODONTO_ESTABELECIMENTO_ID?.trim() || null,
    syncEnabled: enabled && process.env.CONTROLE_ODONTO_SYNC_ENABLED === "true",
    syncIntervalMinutes: lerInteiroPositivo(process.env.CONTROLE_ODONTO_SYNC_INTERVAL_MINUTES, PADRAO_SYNC_INTERVAL_MINUTES),
    syncMargemHoras: lerInteiroPositivo(process.env.CONTROLE_ODONTO_SYNC_MARGEM_HORAS, PADRAO_SYNC_MARGEM_HORAS),
    syncHorizonteDias: lerInteiroPositivo(process.env.CONTROLE_ODONTO_SYNC_HORIZONTE_DIAS, PADRAO_SYNC_HORIZONTE_DIAS),
  };
}
