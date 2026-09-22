import { resolverVariaveis } from "@/lib/mensagens-salvas";
import { encontrarNo, type FluxoDefinicao, type NoCapturarResposta, type NoMenu, type NoAcaoComercial, type OperadorCondicao, type TipoPesquisa } from "@/lib/fluxo-tipos";
import type { StatusConversa } from "@/lib/status";
import type { Prioridade } from "@/lib/prioridade";
import { classificarRespostaExperiencia } from "@/lib/reputacao-experiencia";

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

/**
 * `clinicaNome` opcional (Fase 3, branding dinâmico) — quem já chamava
 * `processarNo` sem essa chave continua funcionando: `{{clinica_nome}}`
 * resolve pra string vazia em vez de derrubar o teste/chamador antigo, mesmo
 * critério de fallback seguro de `resolverVariaveis` (nunca "undefined").
 */
export type ContextoPaciente = { nome: string | null; telefone: string; clinicaNome?: string | null };

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

/**
 * Efeito colateral de I/O de um passo — sempre 0 ou 1 por nó (nunca lista:
 * cada bloco de Ações CRM/Humano+IA faz uma coisa só). A camada de I/O
 * (`fluxo-execucoes.ts`) é quem aplica de verdade contra o banco/WhatsApp.
 * Nome ficou "Crm" da 1ª categoria (Ações CRM); os 4 blocos de Humano+IA
 * entraram no mesmo canal em vez de um campo novo — mecanicamente é o mesmo
 * "uma ação, aplicada por quem faz I/O", não vale abstração nem rename só
 * por causa do nome.
 */
export type AcaoCrm =
  | { tipo: "acao_comercial"; acao: NoAcaoComercial["acao"]; valor: string; motivoPerdaId?: string }
  | { tipo: "adicionar_etiqueta"; etiquetaId: string }
  | { tipo: "remover_etiqueta"; etiquetaId: string }
  | { tipo: "mudar_status"; status: StatusConversa }
  | { tipo: "marcar_prioridade"; prioridade: Prioridade }
  | { tipo: "atribuir_atendente"; atendenteId: string | null }
  | { tipo: "criar_alerta_interno"; mensagem: string; numeros: string }
  | { tipo: "pausar_automacao" }
  | { tipo: "iniciar_agente_ia"; agenteId: string }
  // Fase 3 — infra de pesquisas (ver fluxo-tipos.ts). A camada de I/O
  // (fluxo-execucoes.ts) é quem sabe ler/escrever `pesquisas`/
  // `pesquisa_respostas`; o motor só declara a intenção, com os NOMES das
  // variáveis (não os valores resolvidos) — quem tem o valor mais recente de
  // `variaveis` no momento de aplicar é a camada de I/O, não o motor.
  | { tipo: "criar_pesquisa"; tipoPesquisa: TipoPesquisa; referenciaId: string | null; variavelDestino: string }
  | { tipo: "persistir_resposta_pesquisa"; variavelPesquisaId: string; variavelValor: string; variavelComentario: string | null }
  | { tipo: "registrar_experiencia"; variavelPesquisaId: string; resposta: string; classificacao: "muito_boa" | "boa" | "poderia_melhorar" | "ambiguo" };

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
      /**
       * Fase 3 — rastreabilidade de `capturar_resposta`: preserva a resposta
       * BRUTA recebida (antes de normalizar), gravada em
       * `fluxo_execucao_eventos.payload` pela camada de I/O. Não duplica em
       * `fluxo_execucoes.variaveis` (que já guarda o valor normalizado) — a
       * mensagem original também já vive em `mensagens`, isso aqui é só o
       * vínculo direto com o passo que a validou.
       */
      payloadEvento?: Record<string, unknown>;
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
  const comBase = resolverVariaveis(texto, { nome: paciente.nome, telefone: paciente.telefone, clinicaNome: paciente.clinicaNome });
  return comBase.replace(/\{([a-z_][a-z0-9_]*)\}/g, (match, chave: string) => {
    if (chave === "nome" || chave === "primeiro_nome" || chave === "telefone" || chave === "clinica_nome") return match; // já resolvido acima
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
  if (["maior", "menor", "maior_igual", "menor_igual"].includes(operador)) {
    if (!valorVariavel?.trim() || !valorComparado?.trim()) return false;
    const a = Number(valorVariavel), b = Number(valorComparado);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return operador === "maior" ? a > b : operador === "menor" ? a < b : operador === "maior_igual" ? a >= b : a <= b;
  }
  switch (operador) {
    case "maior": case "menor": case "maior_igual": case "menor_igual": return false;
    case "contem_item": return Boolean(valorComparado) && (valorVariavel ?? "").split(",").includes(valorComparado!);
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

/** Mesmo fallback de `fallbackMenu`, pro nó `capturar_resposta` (`proximoTimeout` próprio). */
function fallbackCaptura(no: NoCapturarResposta, motivo: string): ResultadoPasso {
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

/**
 * `numero`: aceita vírgula decimal (padrão pt-BR de digitação no WhatsApp),
 * valida min/max quando configurados. `texto`: valida `regex` só quando
 * configurada — regex inválida configurada não trava o paciente (aceita como
 * está, mesmo espírito de nunca deixar um erro de configuração virar
 * atendimento travado). Vazio: aceito só se `obrigatorio === false`.
 */
function validarRespostaCapturada(no: NoCapturarResposta, textoRecebido: string): { ok: true; valor: string } | { ok: false } {
  const bruto = textoRecebido.trim();
  if (!bruto) return no.obrigatorio === false ? { ok: true, valor: "" } : { ok: false };

  if (no.tipoValor === "numero") {
    const numero = Number(bruto.replace(",", "."));
    if (!Number.isFinite(numero)) return { ok: false };
    if (no.min !== undefined && numero < no.min) return { ok: false };
    if (no.max !== undefined && numero > no.max) return { ok: false };
    return { ok: true, valor: String(numero) };
  }

  if (no.regex) {
    try {
      if (!new RegExp(no.regex).test(bruto)) return { ok: false };
    } catch {
      // regex inválida configurada — aceita como está, não trava o paciente.
    }
  }
  return { ok: true, valor: bruto };
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
    case "acao_comercial":
      return { ok: true, proximoNoId: no.proximo, novoEstado: "queued", aguardandoAte: agora.toISOString(), mensagensParaEnviar: [], variaveisAtualizadas: {},
        acaoCrm: { tipo: "acao_comercial", acao: no.acao, valor: ["nota", "alerta", "interesse"].includes(no.acao) ? resolverVariaveisFluxo(no.valor, variaveis, paciente) : no.valor, motivoPerdaId: no.motivoPerdaId }, tipoEvento: `comercial_${no.acao}` };
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

    // Terminal: dono_conversa volta pro humano de graça, pelo `liberarControle`
    // genérico que já roda ao terminar qualquer execução — ver fluxo-execucoes.ts.
    case "transferir_humano": {
      const mensagem = no.mensagem ? resolverVariaveisFluxo(no.mensagem, variaveis, paciente) : null;
      return {
        ok: true,
        proximoNoId: null,
        novoEstado: "transferred",
        aguardandoAte: null,
        mensagensParaEnviar: mensagem ? [mensagem] : [],
        variaveisAtualizadas: {},
        acaoCrm: null,
        motivoFinalizacao: no.motivo,
        tipoEvento: "transferido_humano",
      };
    }

    case "criar_alerta_interno": {
      const mensagem = resolverVariaveisFluxo(no.mensagem, variaveis, paciente);
      return {
        ok: true,
        proximoNoId: no.proximo,
        novoEstado: "queued",
        aguardandoAte: agora.toISOString(),
        mensagensParaEnviar: [],
        variaveisAtualizadas: {},
        acaoCrm: { tipo: "criar_alerta_interno", mensagem, numeros: no.numeros },
        tipoEvento: "alerta_interno_criado",
      };
    }

    case "pausar_automacao":
      return {
        ok: true,
        proximoNoId: no.proximo,
        novoEstado: "queued",
        aguardandoAte: agora.toISOString(),
        mensagensParaEnviar: [],
        variaveisAtualizadas: {},
        acaoCrm: { tipo: "pausar_automacao" },
        tipoEvento: "automacao_pausada",
      };

    // Terminal: entrega a conversa pro agente escolhido — dono_conversa vira
    // 'agente_ia', NUNCA 'humano' (o `liberarControle` genérico é pulado
    // pra este tipo especificamente, ver fluxo-execucoes.ts).
    case "iniciar_agente_ia":
      return {
        ok: true,
        proximoNoId: null,
        novoEstado: "transferred",
        aguardandoAte: null,
        mensagensParaEnviar: [],
        variaveisAtualizadas: {},
        acaoCrm: { tipo: "iniciar_agente_ia", agenteId: no.agenteId },
        motivoFinalizacao: no.motivo,
        tipoEvento: "agente_ia_iniciado",
      };

    // Fase 3 — genérico (texto ou número validado), nunca "capturar_nps": ver
    // fluxo-tipos.ts. Mesma máquina de estados de `menu` (waiting_input,
    // guarda de loop, fallback por timeout/tentativas esgotadas), aplicada a
    // entrada aberta em vez de escolha fechada.
    case "capturar_resposta": {
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
          tipoEvento: "captura_iniciada",
        };
      }

      if (entrada.tipo === "timeout") {
        return fallbackCaptura(no, "captura_timeout");
      }

      // resposta_texto
      const validado = validarRespostaCapturada(no, entrada.texto);
      if (!validado.ok) {
        const maxInvalidas = no.maxTentativasInvalidas ?? MAX_TENTATIVAS_INVALIDAS_PADRAO;
        if (contadores.tentativasInvalidas + 1 >= maxInvalidas) {
          return fallbackCaptura(no, "captura_tentativas_esgotadas");
        }
        return {
          ok: true,
          proximoNoId: no.id,
          novoEstado: "waiting_input",
          aguardandoAte: no.timeoutSegundos ? new Date(agora.getTime() + no.timeoutSegundos * 1000).toISOString() : null,
          mensagensParaEnviar: [
            no.mensagemValidacao ? resolverVariaveisFluxo(no.mensagemValidacao, variaveis, paciente) : MENSAGEM_INVALIDA_PADRAO,
          ],
          variaveisAtualizadas: {},
          acaoCrm: null,
          tipoEvento: "captura_invalida",
          payloadEvento: { respostaBruta: entrada.texto },
        };
      }

      return {
        ok: true,
        proximoNoId: no.proximo,
        novoEstado: "queued",
        aguardandoAte: agora.toISOString(),
        mensagensParaEnviar: [],
        variaveisAtualizadas: { [no.variavel]: validado.valor },
        acaoCrm: null,
        tipoEvento: "captura_concluida",
        payloadEvento: { respostaBruta: entrada.texto, valorNormalizado: validado.valor },
      };
    }

    case "criar_pesquisa": {
      const referenciaId = no.referenciaId ? resolverVariaveisFluxo(no.referenciaId, variaveis, paciente) : null;
      return {
        ok: true,
        proximoNoId: no.proximo,
        novoEstado: "queued",
        aguardandoAte: agora.toISOString(),
        mensagensParaEnviar: [],
        variaveisAtualizadas: {},
        acaoCrm: { tipo: "criar_pesquisa", tipoPesquisa: no.tipoPesquisa, referenciaId, variavelDestino: no.variavelDestino },
        tipoEvento: "pesquisa_criada",
      };
    }

    case "persistir_resposta_pesquisa":
      return {
        ok: true,
        proximoNoId: no.proximo,
        novoEstado: "queued",
        aguardandoAte: agora.toISOString(),
        mensagensParaEnviar: [],
        variaveisAtualizadas: {},
        acaoCrm: {
          tipo: "persistir_resposta_pesquisa",
          variavelPesquisaId: no.variavelPesquisaId,
          variavelValor: no.variavelValor,
          variavelComentario: no.variavelComentario ?? null,
        },
        tipoEvento: "resposta_pesquisa_persistida",
      };

    case "classificar_experiencia": {
      const resposta = variaveis[no.variavelResposta] ?? "";
      const classificacao = classificarRespostaExperiencia(resposta);
      const proximoNoId = classificacao === "poderia_melhorar" ? no.proximoNegativo : classificacao === "ambiguo" ? no.proximoAmbiguo : no.proximoPositivo;
      return { ok: true, proximoNoId, novoEstado: "queued", aguardandoAte: agora.toISOString(), mensagensParaEnviar: [], variaveisAtualizadas: { [no.variavelClassificacao]: classificacao }, acaoCrm: { tipo: "registrar_experiencia", variavelPesquisaId: no.variavelPesquisaId, resposta, classificacao }, tipoEvento: "experiencia_classificada", payloadEvento: { respostaBruta: resposta, classificacao } };
    }
  }
}
