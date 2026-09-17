import { resolverVariaveis } from "@/lib/mensagens-salvas";
import { encontrarNo, type FluxoDefinicao, type NoMenu, type OperadorCondicao } from "@/lib/fluxo-tipos";
import type { StatusConversa } from "@/lib/status";
import type { Prioridade } from "@/lib/prioridade";

/**
 * Interpretador PURO do motor de Fluxo de Conversa — Fase 2a (ver
 * crm/docs/fluxo-conversa-arquitetura.md). Recebe o estado atual e uma
 * entrada, devolve o resultado de processar UM nó — nunca toca banco/rede.
 * A camada de I/O (`fluxo-execucoes.ts`) é quem persiste o resultado, manda a
 * mensagem de verdade (com retry) e decide sobre opt-out. Mesmo critério de
 * separação já usado em `funil.ts` (`decidirTransicaoWebhook`) e `agentes.ts`
 * (`deveResponder`): a decisão é pura e testável, o efeito colateral não é.
 *
 * Testado exaustivamente em `fluxo-motor.test.ts` — todo caso de borda vive
 * lá, não em produção.
 */

export type EntradaProcessamento = { tipo: "avancar" } | { tipo: "resposta_texto"; texto: string } | { tipo: "timeout" };

export type ContextoPaciente = { nome: string | null; telefone: string };

export type EstadoExecucao =
  | "queued"
  | "waiting_time"
  | "waiting_input"
  | "completed"
  | "cancelled"
  | "failed"
  | "transferred";

export type ContadoresNo = {
  /** Visitas reais anteriores a este nó (exclui tentativas de menu inválidas). */
  visitas: number;
  /** Tentativas de resposta inválida já registradas NESTA estadia no nó de menu (zera a cada nova visita real). */
  tentativasInvalidas: number;
};

/** Efeito colateral de CRM de um passo — sempre 0 ou 1 por nó (nunca lista: cada bloco de Ações CRM faz uma coisa só). A camada de I/O (`fluxo-execucoes.ts`) é quem aplica de verdade contra o banco. */
export type AcaoCrm =
  | { tipo: "adicionar_etiqueta"; etiquetaId: string }
  | { tipo: "remover_etiqueta"; etiquetaId: string }
  | { tipo: "mudar_status"; status: StatusConversa }
  | { tipo: "marcar_prioridade"; prioridade: Prioridade }
  | { tipo: "atribuir_atendente"; atendenteId: string | null };

export type ResultadoPasso =
  | {
      ok: true;
      proximoNoId: string | null;
      novoEstado: EstadoExecucao;
      aguardandoAte: string | null;
      mensagensParaEnviar: string[];
      variaveisAtualizadas: Record<string, string>;
      motivoFinalizacao?: string;
      /** null quando o nó não é de Ações CRM — mesmo padrão de "sempre presente, nunca opcional" já usado em `aguardandoAte`. */
      acaoCrm: AcaoCrm | null;
      /** Pro log em fluxo_execucao_eventos.tipo_evento. */
      tipoEvento: string;
    }
  | { ok: false; erro: string };

const MAX_ITERACOES_PADRAO = 3;
const MAX_TENTATIVAS_INVALIDAS_PADRAO = 3;
const MENSAGEM_INVALIDA_PADRAO = "Não consegui identificar sua resposta. Pode tentar de novo?";

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * `{nome}`/`{primeiro_nome}`/`{telefone}` via `resolverVariaveis`
 * (`mensagens-salvas.ts`, mesmo fallback seguro — nunca "undefined"); depois,
 * uma 2ª passada substitui `{chave}` por qualquer variável custom do fluxo
 * (setada por um nó `condicao`/entrada anterior). Chave desconhecida vira
 * string vazia — mesmo princípio de nunca vazar "undefined"/"[object Object]".
 */
export function resolverVariaveisFluxo(texto: string, variaveis: Record<string, string>, paciente: ContextoPaciente): string {
  const comBase = resolverVariaveis(texto, { nome: paciente.nome, telefone: paciente.telefone });
  return comBase.replace(/\{([a-z_][a-z0-9_]*)\}/g, (match, chave: string) => {
    if (chave === "nome" || chave === "primeiro_nome" || chave === "telefone") return match; // já resolvido acima
    return variaveis[chave] ?? "";
  });
}

function casarOpcaoMenu(no: NoMenu, textoRecebido: string): string | null {
  const normalizado = normalizar(textoRecebido);
  if (!normalizado) return null;

  // Numérico: "1", "01" (zero à esquerda) casam pela posição 1-based da opção.
  const comoNumero = Number.parseInt(normalizado.replace(/^0+(?=\d)/, ""), 10);
  if (Number.isInteger(comoNumero) && String(comoNumero) === normalizado.replace(/^0+(?=\d)/, "")) {
    const porPosicao = no.opcoes[comoNumero - 1];
    if (porPosicao) return porPosicao.proximo;
  }

  for (const opcao of no.opcoes) {
    if (opcao.rotulos.some((r) => normalizar(r) === normalizado)) return opcao.proximo;
  }
  return null;
}

function avaliarCondicao(operador: OperadorCondicao, valorVariavel: string | undefined, valorComparado: string | undefined): boolean {
  switch (operador) {
    case "igual":
      return valorVariavel === valorComparado;
    case "diferente":
      return valorVariavel !== valorComparado;
    case "contem":
      return (valorVariavel ?? "").includes(valorComparado ?? "");
    case "existe":
      return valorVariavel !== undefined && valorVariavel !== "";
    case "nao_existe":
      return valorVariavel === undefined || valorVariavel === "";
  }
}

/** Resultado do fallback compartilhado por timeout de menu e tentativas inválidas esgotadas. */
function fallbackMenu(no: NoMenu, motivo: string): ResultadoPasso {
  if (no.proximoTimeout) {
    return {
      ok: true,
      proximoNoId: no.proximoTimeout,
      novoEstado: "queued",
      aguardandoAte: new Date().toISOString(),
      mensagensParaEnviar: [],
      variaveisAtualizadas: {},
      acaoCrm: null,
      tipoEvento: motivo,
    };
  }
  return {
    ok: true,
    proximoNoId: null,
    novoEstado: "transferred",
    aguardandoAte: null,
    mensagensParaEnviar: [],
    variaveisAtualizadas: {},
    acaoCrm: null,
    motivoFinalizacao: motivo,
    tipoEvento: motivo,
  };
}

export function processarNo(
  definicao: FluxoDefinicao,
  noId: string,
  variaveis: Record<string, string>,
  entrada: EntradaProcessamento,
  paciente: ContextoPaciente,
  contadores: ContadoresNo,
  agora: Date = new Date()
): ResultadoPasso {
  const no = encontrarNo(definicao, noId);
  if (!no) return { ok: false, erro: `no_nao_encontrado:${noId}` };

  // Disjuntor de loop — aplicado antes de despachar, pra qualquer tipo de nó.
  // Visitas de menu com resposta inválida não contam aqui (têm o próprio teto).
  if (contadores.visitas >= MAX_ITERACOES_PADRAO) {
    return { ok: false, erro: "loop_maximo_excedido" };
  }

  switch (no.tipo) {
    case "inicio":
      return {
        ok: true,
        proximoNoId: no.proximo,
        novoEstado: "queued",
        aguardandoAte: agora.toISOString(),
        mensagensParaEnviar: [],
        variaveisAtualizadas: {},
        acaoCrm: null,
        tipoEvento: "inicio",
      };

    case "mensagem": {
      const texto = resolverVariaveisFluxo(no.texto, variaveis, paciente);
      return {
        ok: true,
        proximoNoId: no.proximo,
        novoEstado: "queued",
        aguardandoAte: agora.toISOString(),
        mensagensParaEnviar: [texto],
        variaveisAtualizadas: {},
        acaoCrm: null,
        tipoEvento: "mensagem_enviada",
      };
    }

    case "espera":
      return {
        ok: true,
        proximoNoId: no.proximo,
        novoEstado: "waiting_time",
        aguardandoAte: new Date(agora.getTime() + no.duracaoSegundos * 1000).toISOString(),
        mensagensParaEnviar: [],
        variaveisAtualizadas: {},
        acaoCrm: null,
        tipoEvento: "espera_iniciada",
      };

    case "adicionar_etiqueta":
      return {
        ok: true,
        proximoNoId: no.proximo,
        novoEstado: "queued",
        aguardandoAte: agora.toISOString(),
        mensagensParaEnviar: [],
        variaveisAtualizadas: {},
        acaoCrm: { tipo: "adicionar_etiqueta", etiquetaId: no.etiquetaId },
        tipoEvento: "etiqueta_adicionada",
      };

    case "remover_etiqueta":
      return {
        ok: true,
        proximoNoId: no.proximo,
        novoEstado: "queued",
        aguardandoAte: agora.toISOString(),
        mensagensParaEnviar: [],
        variaveisAtualizadas: {},
        acaoCrm: { tipo: "remover_etiqueta", etiquetaId: no.etiquetaId },
        tipoEvento: "etiqueta_removida",
      };

    case "mudar_status":
      return {
        ok: true,
        proximoNoId: no.proximo,
        novoEstado: "queued",
        aguardandoAte: agora.toISOString(),
        mensagensParaEnviar: [],
        variaveisAtualizadas: {},
        acaoCrm: { tipo: "mudar_status", status: no.status },
        tipoEvento: "status_alterado",
      };

    case "marcar_prioridade":
      return {
        ok: true,
        proximoNoId: no.proximo,
        novoEstado: "queued",
        aguardandoAte: agora.toISOString(),
        mensagensParaEnviar: [],
        variaveisAtualizadas: {},
        acaoCrm: { tipo: "marcar_prioridade", prioridade: no.prioridade },
        tipoEvento: "prioridade_marcada",
      };

    case "atribuir_atendente":
      return {
        ok: true,
        proximoNoId: no.proximo,
        novoEstado: "queued",
        aguardandoAte: agora.toISOString(),
        mensagensParaEnviar: [],
        variaveisAtualizadas: {},
        acaoCrm: { tipo: "atribuir_atendente", atendenteId: no.atendenteId },
        tipoEvento: "atendente_atribuido",
      };

    case "menu": {
      if (entrada.tipo === "avancar") {
        const texto = resolverVariaveisFluxo(no.texto, variaveis, paciente);
        return {
          ok: true,
          proximoNoId: no.id,
          novoEstado: "waiting_input",
          aguardandoAte: no.timeoutSegundos ? new Date(agora.getTime() + no.timeoutSegundos * 1000).toISOString() : null,
          mensagensParaEnviar: [texto],
          variaveisAtualizadas: {},
          acaoCrm: null,
          tipoEvento: "menu_enviado",
        };
      }

      if (entrada.tipo === "timeout") {
        return fallbackMenu(no, "menu_timeout");
      }

      // resposta_texto
      const proximo = casarOpcaoMenu(no, entrada.texto);
      if (proximo) {
        return {
          ok: true,
          proximoNoId: proximo,
          novoEstado: "queued",
          aguardandoAte: agora.toISOString(),
          mensagensParaEnviar: [],
          variaveisAtualizadas: {},
          acaoCrm: null,
          tipoEvento: "menu_respondido",
        };
      }

      const maxInvalidas = no.maxTentativasInvalidas ?? MAX_TENTATIVAS_INVALIDAS_PADRAO;
      if (contadores.tentativasInvalidas + 1 >= maxInvalidas) {
        return fallbackMenu(no, "menu_tentativas_invalidas_esgotadas");
      }

      return {
        ok: true,
        proximoNoId: no.id,
        novoEstado: "waiting_input",
        aguardandoAte: no.timeoutSegundos ? new Date(agora.getTime() + no.timeoutSegundos * 1000).toISOString() : null,
        mensagensParaEnviar: [no.mensagemInvalida ? resolverVariaveisFluxo(no.mensagemInvalida, variaveis, paciente) : MENSAGEM_INVALIDA_PADRAO],
        variaveisAtualizadas: {},
        acaoCrm: null,
        tipoEvento: "menu_invalido",
      };
    }

    case "condicao": {
      const bate = avaliarCondicao(no.operador, variaveis[no.variavel], no.valor);
      return {
        ok: true,
        proximoNoId: bate ? no.seVerdadeiro : no.seFalso,
        novoEstado: "queued",
        aguardandoAte: agora.toISOString(),
        mensagensParaEnviar: [],
        variaveisAtualizadas: {},
        acaoCrm: null,
        tipoEvento: "condicao_avaliada",
      };
    }

    case "finalizar":
      return {
        ok: true,
        proximoNoId: null,
        novoEstado: "completed",
        aguardandoAte: null,
        mensagensParaEnviar: [],
        variaveisAtualizadas: {},
        acaoCrm: null,
        motivoFinalizacao: no.motivo,
        tipoEvento: "finalizado",
      };
  }
}
