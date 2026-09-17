/**
 * Tipos do grafo de um Fluxo de Conversa (`fluxo_versoes.definicao`) — Fase
 * 2a, conjunto mínimo de blocos (ver crm/docs/fluxo-conversa-arquitetura.md e
 * crm/docs/fluxo-conversa-visao.md). Paleta completa (Odonto, IA, Humano,
 * Integração) é Fase 3 — os tipos aqui são o contrato que ela vai estender,
 * nunca substituir: um `NoFluxo` novo entra como mais um membro da união
 * discriminada, sem quebrar os 6 que já existem.
 *
 * Validação de FORMA (`validarFormaDefinicao`, hand-rolled — este projeto não
 * usa biblioteca de schema, mesmo critério de `isStatusValido`/
 * `isPrioridadeValida`) roda em toda escrita (autosave, publicar, importar,
 * duplicar), nunca aceita JSON livre. Validação de GRAFO (nó órfão, loop sem
 * guarda, caminho sem saída) é outra coisa — fica em `fluxo-validador.ts`,
 * roda depois que a forma já passou aqui.
 */

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

export type NoFluxo = NoInicio | NoMensagem | NoEspera | NoMenu | NoCondicao | NoFinalizar;

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
