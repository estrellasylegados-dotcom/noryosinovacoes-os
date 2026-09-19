/**
 * Casamento de gatilho de MENSAGEM pra iniciar um Fluxo de Conversa — Fase
 * 2a suporta só os 3 gatilhos que dependem só do que o webhook já sabe
 * (`nova_conversa`/`primeira_mensagem`/`palavra_chave`); os demais da visão
 * (etapa do funil, campanha, disparo, etiqueta, consulta, inatividade, API)
 * entram por outros caminhos (Campanhas/Disparos/cron), não pelo webhook —
 * fora de escopo desta fase. Pura, testável (`fluxo-gatilhos.test.ts`).
 */

export type EventoGatilhoMensagem = { conversaEhNova: boolean; textoMensagem: string };

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function combinaGatilhoMensagem(gatilhoTipo: string, gatilhoConfig: Record<string, unknown>, evento: EventoGatilhoMensagem): boolean {
  switch (gatilhoTipo) {
    case "nova_conversa":
    case "primeira_mensagem":
      return evento.conversaEhNova;

    case "palavra_chave": {
      const palavras = Array.isArray(gatilhoConfig.palavras)
        ? gatilhoConfig.palavras.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
        : [];
      if (palavras.length === 0) return false;
      const textoNormalizado = normalizar(evento.textoMensagem);
      return palavras.some((p) => textoNormalizado.includes(normalizar(p)));
    }

    default:
      return false;
  }
}

/**
 * Só `nova_conversa`/`primeira_mensagem` merecem chave de dedupe permanente
 * (a mesma conversa nunca dispara o "boas-vindas" 2x, nem depois que a
 * execução original já terminou — por isso o índice único de dedupe não é
 * escopado a "execução ativa"). `palavra_chave` fica sem dedupe: a mesma
 * palavra pode legitimamente reabrir o mesmo fluxo em conversas diferentes
 * no tempo (paciente pede "agendar" hoje, de novo daqui a meses) — proteção
 * contra webhook duplicado nesse caso já vem do índice de "execução ativa
 * por conversa", suficiente pra uma reentrega de segundos.
 */
export function dedupeKeyParaGatilho(gatilhoTipo: string, conversaId: string): string | null {
  return gatilhoTipo === "nova_conversa" || gatilhoTipo === "primeira_mensagem" ? conversaId : null;
}

/**
 * Fase 3 (motor central de automação — ver _memoria/decisoes.md): categoriza
 * `gatilho_tipo` sem precisar de coluna nova em `fluxos` (o campo já é texto
 * livre, sem `check` — ver migration v20). O scanner temporal
 * (fluxo-scanner-temporal.ts) usa "temporal" pra saber quais fluxos avaliar;
 * `emitirEventoAutomacao` (fluxo-eventos-internos.ts) usa "interno". Gatilhos
 * temporais além de `aniversario` ficam só PREPARADOS aqui (mapeados, sem
 * regra concreta ainda) — mesmo critério do webhook: existir na lista não
 * significa que já dispara sozinho.
 */
export type CategoriaGatilho = "mensagem" | "temporal" | "interno";

const CATEGORIA_POR_GATILHO: Record<string, CategoriaGatilho> = {
  nova_conversa: "mensagem",
  primeira_mensagem: "mensagem",
  palavra_chave: "mensagem",
  aniversario: "temporal",
  x_dias_sem_resposta: "temporal",
  x_meses_sem_atendimento: "temporal",
  retorno_previsto: "temporal",
  atendimento_concluido: "interno",
  lead_convertido: "interno",
  proposta_apresentada: "interno",
  paciente_inativo: "interno",
  // Fase 5 (Reputação/Google Reviews) — hoje só emitido pela ação manual
  // ("Solicitar avaliação Google" na ficha do paciente, ver
  // src/app/api/reputacao/solicitar/route.ts). Quando existir uma origem
  // confiável de atendimento concluído, ela pode emitir este MESMO tipo
  // (referenciaId = atendimento_id) sem precisar de um fluxo novo.
  solicitacao_avaliacao_google: "interno",
  // Kanban comercial (2026-09-18): emitido por src/lib/kanban.ts DEPOIS de persistir a mudança de
  // estágio. Sem automação ligada nesta fase: só registra em automacao_eventos (fluxo_nao_encontrado).
  kanban_stage_changed: "interno",
};

export function categoriaDoGatilho(gatilhoTipo: string): CategoriaGatilho | null {
  return CATEGORIA_POR_GATILHO[gatilhoTipo] ?? null;
}
