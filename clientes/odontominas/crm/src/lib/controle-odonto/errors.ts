/**
 * Códigos e classes de erro do conector. Funções de borda (appointments.ts,
 * patients.ts, sync.ts, rotas) nunca lançam — devolvem `{ ok: false, error }`,
 * mesmo padrão do resto do CRM (ver evolution-send.ts). As classes abaixo são
 * só pro controle de fluxo interno de client.ts (distinguir o que vale retry
 * do que não vale).
 */

export const ERRO_NAO_CONFIGURADO = "nao_configurado";
export const ERRO_CAPABILITY_DESABILITADA = "capability_desabilitada";
export const ERRO_AUTH_NAO_CONFIRMADA = "auth_nao_confirmada";
export const ERRO_TIMEOUT = "timeout";
export const ERRO_PAYLOAD_INESPERADO = "payload_inesperado";

export function erroHttp(status: number): string {
  return `http_${status}`;
}

export function ehStatusRetentavel(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export class ControleOdontoHttpError extends Error {
  readonly status: number;

  constructor(status: number, message?: string) {
    super(message ?? erroHttp(status));
    this.name = "ControleOdontoHttpError";
    this.status = status;
  }
}

export class ControleOdontoTimeoutError extends Error {
  constructor() {
    super(ERRO_TIMEOUT);
    this.name = "ControleOdontoTimeoutError";
  }
}

export class ControleOdontoAuthNaoConfirmadaError extends Error {
  constructor() {
    super(ERRO_AUTH_NAO_CONFIRMADA);
    this.name = "ControleOdontoAuthNaoConfirmadaError";
  }
}
