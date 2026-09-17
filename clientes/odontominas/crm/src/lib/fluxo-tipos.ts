/**
 * Tipos do grafo de um Fluxo de Conversa (`fluxo_versoes.definicao`) — Fase
 * 2a, conjunto mínimo de blocos, mais a categoria "Ações CRM" (ampliação da
 * paleta, ver crm/docs/fluxo-conversa-visao.md) — a 1ª das 4 categorias extras
 * da visão original (Odonto, IA, Humano, Integração) a entrar, porque não
 * depende de nenhuma capability externa: só escreve em tabelas que o CRM já
 * usa em produção (etiquetas, funil/status, prioridade, atendente). Odonto
 * segue fora enquanto nenhuma capability do ControleODONTO for validada (ver
 * src/lib/controle-odonto/capabilities.ts).
 *
 * Validação de FORMA (`validarFormaDefinicao`, hand-rolled — este projeto não
 * usa biblioteca de schema, mesmo critério de `isStatusValido`/
 * `isPrioridadeValida`) roda em toda escrita (autosave, publicar, importar,
 * duplicar), nunca aceita JSON livre. Validação de GRAFO (nó órfão, loop sem
 * guarda, caminho sem saída) é outra coisa — fica em `fluxo-validador.ts`,
 * roda depois que a forma já passou aqui.
 */

import { isStatusValido, type StatusConversa } from "@/lib/status";
import { isPrioridadeValida, type Prioridade } from "@/lib/prioridade";

export type OperadorCondicao = "igual" | "diferente" | "contem" | "existe" | "nao_existe";
const OPERADORES_CONDICAO: readonly OperadorCondicao[] = ["igual", "diferente", "contem", "existe", "nao_existe"];

export type NoInicio = { id: string; tipo: "inicio"; proximo: string };
export type NoMensagem = { id: string; tipo: "mensagem"; texto: string; proximo: string };
export type NoEspera = { id: string; tipo: "espera"; duracaoSegundos: number; proximo: string };
export type OpcaoMenu = { valor: string; rotulos: string[]; proximo: string };
export type NoMenu = {
  id: string;
  tipo: "menu";
  texto: string;
  opcoes: OpcaoMenu[];
  timeoutSegundos?: number;
  proximoTimeout?: string;
  mensagemInvalida?: string;
  maxTentativasInvalidas?: number;
};
export type NoCondicao = {
  id: string;
  tipo: "condicao";
  variavel: string;
  operador: OperadorCondicao;
  valor?: string;
  seVerdadeiro: string;
  seFalso: string;
};
export type NoFinalizar = { id: string; tipo: "finalizar"; motivo?: string };

/**
 * `etiquetaId` aceita string vazia na FORMA (ver `validarNo`) — bloco recém-
 * arrastado da paleta ainda sem etiqueta escolhida não pode falhar o
 * autosave (mesmo problema que `criarNoPadrao` evita nos outros tipos com um
 * valor padrão não-vazio; aqui não existe um "padrão" razoável, então o vazio
 * é tolerado na forma e barrado na publicação por `validarGrafo`).
 */
export type NoAdicionarEtiqueta = { id: string; tipo: "adicionar_etiqueta"; etiquetaId: string; proximo: string };
export type NoRemoverEtiqueta = { id: string; tipo: "remover_etiqueta"; etiquetaId: string; proximo: string };
export type NoMudarStatus = { id: string; tipo: "mudar_status"; status: StatusConversa; proximo: string };
export type NoMarcarPrioridade = { id: string; tipo: "marcar_prioridade"; prioridade: Prioridade; proximo: string };
/** `atendenteId: null` é estado válido de negócio (desatribuir), não "não configurado" — sem tolerância especial na forma. */
export type NoAtribuirAtendente = { id: string; tipo: "atribuir_atendente"; atendenteId: string | null; proximo: string };

/**
 * Categoria "Humano + IA" (2ª fatia da ampliação da paleta, ver
 * crm/docs/fluxo-conversa-visao.md) — só os 4 blocos que cabem com segurança
 * na arquitetura atual. "Enviar contexto pra agente", "Retomar fluxo após
 * IA" e "Encerrar IA" ficam de fora de propósito: pressupõem um protocolo de
 * handoff `agentes.ts` ↔ motor do fluxo que ainda não existe (enquanto um nó
 * do fluxo executa, `dono_conversa` já é `'fluxo'` — não há "IA ativa
 * durante um passo do fluxo" pra encerrar ou retomar).
 *
 * `transferir_humano`/`iniciar_agente_ia` não têm `proximo`: são terminais,
 * mesmo desenho de `NoFinalizar` — a execução termina como `transferred`. A
 * troca de `dono_conversa` de `transferir_humano` é de graça (o
 * `liberarControle` genérico que já roda ao terminar qualquer execução cobre
 * isso); `iniciar_agente_ia` é o único caso em que esse genérico precisa ser
 * pulado, porque a ação já entregou a conversa pro agente, não pro humano
 * (ver o comentário em `fluxo-execucoes.ts`).
 */
export type NoTransferirHumano = { id: string; tipo: "transferir_humano"; mensagem?: string; motivo?: string };
/** `numeros`: mesmo formato livre separado por vírgula de `AgenteIA.notificarNumeros` (ver agentes-notificacoes.ts). */
export type NoCriarAlertaInterno = { id: string; tipo: "criar_alerta_interno"; mensagem: string; numeros: string; proximo: string };
export type NoPausarAutomacao = { id: string; tipo: "pausar_automacao"; proximo: string };
/** `agenteId` aceita vazio na forma pelo mesmo motivo de `etiquetaId` (ver acima) — barrado na publicação. */
export type NoIniciarAgenteIA = { id: string; tipo: "iniciar_agente_ia"; agenteId: string; motivo?: string };

export type NoFluxo =
  | NoInicio
  | NoMensagem
  | NoEspera
  | NoMenu
  | NoCondicao
  | NoFinalizar
  | NoAdicionarEtiqueta
  | NoRemoverEtiqueta
  | NoMudarStatus
  | NoMarcarPrioridade
  | NoAtribuirAtendente
  | NoTransferirHumano
  | NoCriarAlertaInterno
  | NoPausarAutomacao
  | NoIniciarAgenteIA;

export type FluxoDefinicao = {
  nodes: NoFluxo[];
  // Fase 2a não usa arestas separadas — cada nó carrega seu(s) próprio(s)
  // destino(s) (`proximo`/`seVerdadeiro`/`seFalso`/opções de menu). Campo
  // reservado pra quando o editor visual (Fase 3) precisar de posição/rótulo
  // de aresta independentes do nó de origem.
  edges: unknown[];
  config: Record<string, unknown>;
};

export function encontrarNo(definicao: FluxoDefinicao, noId: string): NoFluxo | null {
  return definicao.nodes.find((n) => n.id === noId) ?? null;
}

export function encontrarNoInicio(definicao: FluxoDefinicao): NoInicio | null {
  const inicios = definicao.nodes.filter((n): n is NoInicio => n.tipo === "inicio");
  return inicios.length === 1 ? inicios[0] : null;
}

type ResultadoValidacaoForma = { ok: true; definicao: FluxoDefinicao } | { ok: false; erro: string };

function ehString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}
function ehStringOpcional(v: unknown): v is string | undefined {
  return v === undefined || (typeof v === "string" && v.length > 0);
}
function ehNumeroPositivo(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}
function ehNumeroPositivoOpcional(v: unknown): v is number | undefined {
  return v === undefined || ehNumeroPositivo(v);
}
function ehStringOuNull(v: unknown): v is string | null {
  return v === null || (typeof v === "string" && v.length > 0);
}

function validarNo(bruto: unknown, indice: number): NoFluxo | string {
  if (typeof bruto !== "object" || bruto === null) return `nó[${indice}]: não é objeto`;
  const n = bruto as Record<string, unknown>;
  if (!ehString(n.id)) return `nó[${indice}]: id ausente ou vazio`;

  switch (n.tipo) {
    case "inicio":
      if (!ehString(n.proximo)) return `nó ${n.id}: "proximo" ausente`;
      return { id: n.id, tipo: "inicio", proximo: n.proximo };

    case "mensagem":
      if (!ehString(n.texto)) return `nó ${n.id}: "texto" ausente`;
      if (!ehString(n.proximo)) return `nó ${n.id}: "proximo" ausente`;
      return { id: n.id, tipo: "mensagem", texto: n.texto, proximo: n.proximo };

    case "espera":
      if (!ehNumeroPositivo(n.duracaoSegundos)) return `nó ${n.id}: "duracaoSegundos" precisa ser número positivo`;
      if (!ehString(n.proximo)) return `nó ${n.id}: "proximo" ausente`;
      return { id: n.id, tipo: "espera", duracaoSegundos: n.duracaoSegundos, proximo: n.proximo };

    case "menu": {
      if (!ehString(n.texto)) return `nó ${n.id}: "texto" ausente`;
      if (!Array.isArray(n.opcoes) || n.opcoes.length === 0) return `nó ${n.id}: precisa de ao menos 1 opção`;
      const opcoes: OpcaoMenu[] = [];
      for (const [i, bruta] of n.opcoes.entries()) {
        if (typeof bruta !== "object" || bruta === null) return `nó ${n.id}, opção[${i}]: não é objeto`;
        const o = bruta as Record<string, unknown>;
        if (!ehString(o.valor)) return `nó ${n.id}, opção[${i}]: "valor" ausente`;
        if (!Array.isArray(o.rotulos) || o.rotulos.length === 0 || !o.rotulos.every((r) => ehString(r))) {
          return `nó ${n.id}, opção[${i}]: "rotulos" precisa de ao menos 1 texto`;
        }
        if (!ehString(o.proximo)) return `nó ${n.id}, opção[${i}]: "proximo" ausente`;
        opcoes.push({ valor: o.valor, rotulos: o.rotulos as string[], proximo: o.proximo });
      }
      if (!ehNumeroPositivoOpcional(n.timeoutSegundos)) return `nó ${n.id}: "timeoutSegundos" inválido`;
      if (!ehStringOpcional(n.proximoTimeout)) return `nó ${n.id}: "proximoTimeout" inválido`;
      if (!ehStringOpcional(n.mensagemInvalida)) return `nó ${n.id}: "mensagemInvalida" inválido`;
      if (!ehNumeroPositivoOpcional(n.maxTentativasInvalidas)) return `nó ${n.id}: "maxTentativasInvalidas" inválido`;
      return {
        id: n.id,
        tipo: "menu",
        texto: n.texto,
        opcoes,
        timeoutSegundos: n.timeoutSegundos,
        proximoTimeout: n.proximoTimeout,
        mensagemInvalida: n.mensagemInvalida,
        maxTentativasInvalidas: n.maxTentativasInvalidas,
      };
    }

    case "condicao":
      if (!ehString(n.variavel)) return `nó ${n.id}: "variavel" ausente`;
      if (typeof n.operador !== "string" || !OPERADORES_CONDICAO.includes(n.operador as OperadorCondicao)) {
        return `nó ${n.id}: "operador" inválido`;
      }
      if (!ehStringOpcional(n.valor)) return `nó ${n.id}: "valor" inválido`;
      if (!ehString(n.seVerdadeiro)) return `nó ${n.id}: "seVerdadeiro" ausente`;
      if (!ehString(n.seFalso)) return `nó ${n.id}: "seFalso" ausente`;
      return {
        id: n.id,
        tipo: "condicao",
        variavel: n.variavel,
        operador: n.operador as OperadorCondicao,
        valor: n.valor,
        seVerdadeiro: n.seVerdadeiro,
        seFalso: n.seFalso,
      };

    case "finalizar":
      if (!ehStringOpcional(n.motivo)) return `nó ${n.id}: "motivo" inválido`;
      return { id: n.id, tipo: "finalizar", motivo: n.motivo };

    case "transferir_humano":
      if (!ehStringOpcional(n.mensagem)) return `nó ${n.id}: "mensagem" inválida`;
      if (!ehStringOpcional(n.motivo)) return `nó ${n.id}: "motivo" inválido`;
      return { id: n.id, tipo: "transferir_humano", mensagem: n.mensagem, motivo: n.motivo };

    case "criar_alerta_interno":
      if (!ehString(n.mensagem)) return `nó ${n.id}: "mensagem" ausente`;
      if (typeof n.numeros !== "string") return `nó ${n.id}: "numeros" ausente`;
      if (!ehString(n.proximo)) return `nó ${n.id}: "proximo" ausente`;
      return { id: n.id, tipo: "criar_alerta_interno", mensagem: n.mensagem, numeros: n.numeros, proximo: n.proximo };

    case "pausar_automacao":
      if (!ehString(n.proximo)) return `nó ${n.id}: "proximo" ausente`;
      return { id: n.id, tipo: "pausar_automacao", proximo: n.proximo };

    case "iniciar_agente_ia":
      if (typeof n.agenteId !== "string") return `nó ${n.id}: "agenteId" ausente`;
      if (!ehStringOpcional(n.motivo)) return `nó ${n.id}: "motivo" inválido`;
      return { id: n.id, tipo: "iniciar_agente_ia", agenteId: n.agenteId, motivo: n.motivo };

    case "adicionar_etiqueta":
      if (typeof n.etiquetaId !== "string") return `nó ${n.id}: "etiquetaId" ausente`;
      if (!ehString(n.proximo)) return `nó ${n.id}: "proximo" ausente`;
      return { id: n.id, tipo: "adicionar_etiqueta", etiquetaId: n.etiquetaId, proximo: n.proximo };

    case "remover_etiqueta":
      if (typeof n.etiquetaId !== "string") return `nó ${n.id}: "etiquetaId" ausente`;
      if (!ehString(n.proximo)) return `nó ${n.id}: "proximo" ausente`;
      return { id: n.id, tipo: "remover_etiqueta", etiquetaId: n.etiquetaId, proximo: n.proximo };

    case "mudar_status":
      if (typeof n.status !== "string" || !isStatusValido(n.status)) return `nó ${n.id}: "status" inválido`;
      if (!ehString(n.proximo)) return `nó ${n.id}: "proximo" ausente`;
      return { id: n.id, tipo: "mudar_status", status: n.status, proximo: n.proximo };

    case "marcar_prioridade":
      if (typeof n.prioridade !== "string" || !isPrioridadeValida(n.prioridade)) return `nó ${n.id}: "prioridade" inválida`;
      if (!ehString(n.proximo)) return `nó ${n.id}: "proximo" ausente`;
      return { id: n.id, tipo: "marcar_prioridade", prioridade: n.prioridade, proximo: n.proximo };

    case "atribuir_atendente":
      if (!ehStringOuNull(n.atendenteId)) return `nó ${n.id}: "atendenteId" inválido`;
      if (!ehString(n.proximo)) return `nó ${n.id}: "proximo" ausente`;
      return { id: n.id, tipo: "atribuir_atendente", atendenteId: n.atendenteId, proximo: n.proximo };

    default:
      return `nó ${n.id}: tipo desconhecido "${String(n.tipo)}"`;
  }
}

/** Valida a FORMA de um `definicao` bruto (vindo do banco, de um import, ou de um autosave). Nunca valida o grafo — ver `fluxo-validador.ts`. */
export function validarFormaDefinicao(bruto: unknown): ResultadoValidacaoForma {
  if (typeof bruto !== "object" || bruto === null) return { ok: false, erro: "definicao precisa ser objeto" };
  const d = bruto as Record<string, unknown>;

  if (!Array.isArray(d.nodes) || d.nodes.length === 0) return { ok: false, erro: "nodes precisa ser lista não-vazia" };

  const nodes: NoFluxo[] = [];
  for (const [i, bruto2] of d.nodes.entries()) {
    const resultado = validarNo(bruto2, i);
    if (typeof resultado === "string") return { ok: false, erro: resultado };
    nodes.push(resultado);
  }

  const ids = nodes.map((n) => n.id);
  const idsUnicos = new Set(ids);
  if (idsUnicos.size !== ids.length) return { ok: false, erro: "ids de nó duplicados" };

  return {
    ok: true,
    definicao: {
      nodes,
      edges: Array.isArray(d.edges) ? d.edges : [],
      config: typeof d.config === "object" && d.config !== null ? (d.config as Record<string, unknown>) : {},
    },
  };
}
