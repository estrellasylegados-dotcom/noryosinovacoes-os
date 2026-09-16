import { ControleOdontoAuthNaoConfirmadaError } from "./errors";

/**
 * Abstração de autenticação — o mecanismo real (API Key, Bearer, Basic,
 * OAuth) não está confirmado publicamente (ver docs/integrations/controle-odonto.md).
 * O resto do conector nunca precisa saber qual mecanismo é: quando o
 * contrato chegar, cria-se uma implementação nova (ex. `ApiKeyAuthProvider`)
 * e troca-se só aqui.
 */
export interface ControleOdontoAuthProvider {
  aplicarAutenticacao(init: RequestInit): RequestInit;
}

/**
 * Provider padrão enquanto o mecanismo não é confirmado: lança sempre.
 * client.ts nunca chega a usar isso de verdade em produção, porque
 * capabilities.ts já bloqueia antes — esta é a 2ª camada de defesa, não a
 * única (defesa em profundidade: mesmo que alguém pule o check de
 * capability por engano, a chamada real ainda não sai).
 */
export class AutenticacaoNaoConfirmadaProvider implements ControleOdontoAuthProvider {
  aplicarAutenticacao(): RequestInit {
    throw new ControleOdontoAuthNaoConfirmadaError();
  }
}

export function getAuthProvider(): ControleOdontoAuthProvider {
  return new AutenticacaoNaoConfirmadaProvider();
}
