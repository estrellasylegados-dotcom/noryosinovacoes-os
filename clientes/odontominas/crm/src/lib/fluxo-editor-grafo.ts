import type { NoFluxo, NoMenu } from "@/lib/fluxo-tipos";

/**
 * Ponte pura entre o grafo do editor visual (xyflow: nodes + edges
 * independentes) e o contrato da engine (`NoFluxo`, onde cada nó carrega
 * seu(s) próprio(s) destino(s) inline — `proximo`/`seVerdadeiro`/`seFalso`/
 * `opcoes[].proximo`). Arestas nunca são estado guardado: são sempre
 * DERIVADAS dos nós (`derivarArestasXyflow`) num sentido só; a mutação do
 * usuário no canvas sempre volta pro nó (`aplicarConexao`), nunca pra uma
 * lista de arestas separada — isso elimina de raiz o risco de duas fontes de
 * verdade divergirem. Zero I/O, zero dependência de xyflow (só os tipos de
 * aresta que o canvas precisa), testável sem mock nenhum.
 */

export type ArestaEditor = { id: string; source: string; sourceHandle: string; target: string };

export function criarNoPadrao(tipo: NoFluxo["tipo"], id: string): NoFluxo {
  switch (tipo) {
    case "inicio":
      // Auto-referenciado: sintaticamente válido pra validarFormaDefinicao
      // (schema não aceita string vazia), e validarGrafo já sinaliza sozinho
      // "loop sem guarda"/"inalcançável" até o usuário arrastar uma conexão
      // de verdade — nenhum estado "pendente" precisa ser inventado.
      return { id, tipo: "inicio", proximo: id };
    case "mensagem":
      return { id, tipo: "mensagem", texto: "Nova mensagem", proximo: id };
    case "espera":
      return { id, tipo: "espera", duracaoSegundos: 60, proximo: id };
    case "menu":
      return { id, tipo: "menu", texto: "Escolha uma opção", opcoes: [{ valor: "1", rotulos: ["1"], proximo: id }] };
    case "condicao":
      return { id, tipo: "condicao", variavel: "variavel", operador: "existe", seVerdadeiro: id, seFalso: id };
    case "finalizar":
      return { id, tipo: "finalizar" };
    case "adicionar_etiqueta":
      return { id, tipo: "adicionar_etiqueta", etiquetaId: "", proximo: id };
    case "remover_etiqueta":
      return { id, tipo: "remover_etiqueta", etiquetaId: "", proximo: id };
    case "mudar_status":
      return { id, tipo: "mudar_status", status: "respondido", proximo: id };
    case "marcar_prioridade":
      return { id, tipo: "marcar_prioridade", prioridade: "normal", proximo: id };
    case "atribuir_atendente":
      return { id, tipo: "atribuir_atendente", atendenteId: null, proximo: id };
    case "transferir_humano":
      return { id, tipo: "transferir_humano" };
    case "criar_alerta_interno":
      return { id, tipo: "criar_alerta_interno", mensagem: "Alerta interno do fluxo.", numeros: "", proximo: id };
    case "pausar_automacao":
      return { id, tipo: "pausar_automacao", proximo: id };
    case "iniciar_agente_ia":
      return { id, tipo: "iniciar_agente_ia", agenteId: "" };
    case "capturar_resposta":
      return { id, tipo: "capturar_resposta", texto: "Sua pergunta aqui", variavel: "resposta", tipoValor: "texto", proximo: id };
    case "criar_pesquisa":
      return { id, tipo: "criar_pesquisa", tipoPesquisa: "nps", variavelDestino: "pesquisa_id", proximo: id };
    case "persistir_resposta_pesquisa":
      return { id, tipo: "persistir_resposta_pesquisa", variavelPesquisaId: "pesquisa_id", variavelValor: "resposta", proximo: id };
  }
}

/** 1 aresta por conector de SAÍDA de cada nó. `id` usa o handle, não `(source,target)` — duas opções de menu podem legitimamente apontar pro mesmo destino. */
export function derivarArestasXyflow(nodes: NoFluxo[]): ArestaEditor[] {
  const arestas: ArestaEditor[] = [];
  for (const no of nodes) {
    switch (no.tipo) {
      case "inicio":
      case "mensagem":
      case "espera":
      case "adicionar_etiqueta":
      case "remover_etiqueta":
      case "mudar_status":
      case "marcar_prioridade":
      case "atribuir_atendente":
      case "criar_alerta_interno":
      case "pausar_automacao":
      case "criar_pesquisa":
      case "persistir_resposta_pesquisa":
        arestas.push({ id: `${no.id}::default`, source: no.id, sourceHandle: "default", target: no.proximo });
        break;
      case "condicao":
        arestas.push({ id: `${no.id}::verdadeiro`, source: no.id, sourceHandle: "verdadeiro", target: no.seVerdadeiro });
        arestas.push({ id: `${no.id}::falso`, source: no.id, sourceHandle: "falso", target: no.seFalso });
        break;
      case "menu":
        no.opcoes.forEach((opcao, indice) => {
          arestas.push({ id: `${no.id}::opcao:${indice}`, source: no.id, sourceHandle: `opcao:${indice}`, target: opcao.proximo });
        });
        if (no.proximoTimeout) {
          arestas.push({ id: `${no.id}::timeout`, source: no.id, sourceHandle: "timeout", target: no.proximoTimeout });
        }
        break;
      case "capturar_resposta":
        arestas.push({ id: `${no.id}::default`, source: no.id, sourceHandle: "default", target: no.proximo });
        if (no.proximoTimeout) {
          arestas.push({ id: `${no.id}::timeout`, source: no.id, sourceHandle: "timeout", target: no.proximoTimeout });
        }
        break;
      case "finalizar":
      case "transferir_humano":
      case "iniciar_agente_ia":
        break;
    }
  }
  return arestas;
}

/** Caminho inverso: o usuário conecta/reconecta no canvas → muta o campo certo do NoFluxo de origem, nunca guarda a aresta em lugar nenhum. */
export function aplicarConexao(nodes: NoFluxo[], source: string, sourceHandle: string, target: string): NoFluxo[] {
  return nodes.map((no) => {
    if (no.id !== source) return no;
    switch (no.tipo) {
      case "inicio":
      case "mensagem":
      case "espera":
      case "adicionar_etiqueta":
      case "remover_etiqueta":
      case "mudar_status":
      case "marcar_prioridade":
      case "atribuir_atendente":
      case "criar_alerta_interno":
      case "pausar_automacao":
      case "criar_pesquisa":
      case "persistir_resposta_pesquisa":
        return sourceHandle === "default" ? { ...no, proximo: target } : no;
      case "condicao":
        if (sourceHandle === "verdadeiro") return { ...no, seVerdadeiro: target };
        if (sourceHandle === "falso") return { ...no, seFalso: target };
        return no;
      case "menu": {
        if (sourceHandle === "timeout") return { ...no, proximoTimeout: target };
        const opcaoMatch = /^opcao:(\d+)$/.exec(sourceHandle);
        if (!opcaoMatch) return no;
        const indice = Number(opcaoMatch[1]);
        if (indice < 0 || indice >= no.opcoes.length) return no;
        return { ...no, opcoes: no.opcoes.map((o, i) => (i === indice ? { ...o, proximo: target } : o)) };
      }
      case "capturar_resposta":
        if (sourceHandle === "timeout") return { ...no, proximoTimeout: target };
        return sourceHandle === "default" ? { ...no, proximo: target } : no;
      case "finalizar":
      case "transferir_humano":
      case "iniciar_agente_ia":
        return no;
    }
  });
}

/** Só o conector "timeout" (menu ou capturar_resposta) é opcional — os demais são obrigatórios pro schema (string vazia é inválida) e só podem ser re-arrastados, nunca apagados via canvas. */
export function podeDeletarAresta(no: NoFluxo, sourceHandle: string): boolean {
  return (no.tipo === "menu" || no.tipo === "capturar_resposta") && sourceHandle === "timeout";
}

export function limparConectorOpcional(no: NoFluxo, sourceHandle: string): NoFluxo {
  if ((no.tipo === "menu" || no.tipo === "capturar_resposta") && sourceHandle === "timeout") {
    return { ...no, proximoTimeout: undefined };
  }
  return no;
}

export function adicionarOpcaoMenu(no: NoMenu): NoMenu {
  const proximoValor = String(no.opcoes.length + 1);
  return { ...no, opcoes: [...no.opcoes, { valor: proximoValor, rotulos: [proximoValor], proximo: no.id }] };
}

/** Nunca remove a última opção — validarFormaDefinicao exige ao menos 1. */
export function removerOpcaoMenu(no: NoMenu, indice: number): NoMenu {
  if (no.opcoes.length <= 1) return no;
  return { ...no, opcoes: no.opcoes.filter((_, i) => i !== indice) };
}

export function atualizarNo(nodes: NoFluxo[], id: string, atualizado: NoFluxo): NoFluxo[] {
  return nodes.map((n) => (n.id === id ? atualizado : n));
}

/** Deleta o nó; referências de outros nós que apontavam pra ele ficam soltas de propósito — validarGrafo aponta a quebra, o usuário rewire. */
export function removerNo(nodes: NoFluxo[], id: string): NoFluxo[] {
  return nodes.filter((n) => n.id !== id);
}

export function adicionarNo(nodes: NoFluxo[], no: NoFluxo): NoFluxo[] {
  return [...nodes, no];
}
