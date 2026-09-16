import type { ControleOdontoEntityType } from "./types";

/**
 * Sem endpoint de profissionais confirmado publicamente — nomes/ids de
 * profissional só chegariam embutidos no payload de agendamento, quando
 * esse contrato existir (ver docs/integrations/controle-odonto.md). Este
 * arquivo existe pra manter a separação por domínio da arquitetura pedida;
 * ganha funções reais quando a API expuser algo dedicado e confirmado.
 */
export const ENTIDADE_PROFISSIONAL: ControleOdontoEntityType = "profissional";
