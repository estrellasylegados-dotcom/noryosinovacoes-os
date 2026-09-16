import { getControleOdontoConfig } from "./config";

/**
 * O id do estabelecimento vem de configuração
 * (CONTROLE_ODONTO_ESTABELECIMENTO_ID), não de uma consulta à API — não há
 * endpoint de estabelecimentos confirmado publicamente. Este arquivo existe
 * pra manter a separação por domínio da arquitetura pedida; ganha mais
 * conteúdo se a API expuser um endpoint de consulta confirmado.
 */
export function getEstabelecimentoIdConfigurado(): string | null {
  return getControleOdontoConfig().estabelecimentoId;
}
