import { encontrarNoInicio, type FluxoDefinicao, type NoFluxo } from "@/lib/fluxo-tipos";

/**
 * Validação de GRAFO de um Fluxo de Conversa — roda depois que
 * `validarFormaDefinicao` (fluxo-tipos.ts) já confirmou que cada nó tem os
 * campos certos. Pura, sem I/O — chamada tanto pela publicação quanto por
 * importar/duplicar (nunca só pelo botão "Publicar" da Fase 3, mesmo
 * critério de `atualizarStatus`/`deveResponder` deste projeto: lógica de
 * negócio compartilhada não mora na UI).
 *
 * Erros bloqueiam publicação; avisos não.
 *
 * `mensagem` é o mesmo texto livre de sempre (log/auditoria); `noIds` é
 * metadado adicionado pro editor visual (Fase 2b/3) destacar no canvas
 * exatamente quais nós um problema envolve, sem precisar fazer parsing do
 * texto — alguns problemas (ciclo, início duplicado) envolvem mais de 1 nó.
 */

export type ProblemaGrafo = { noIds: string[]; mensagem: string };
export type ResultadoValidacaoGrafo = { erros: ProblemaGrafo[]; avisos: ProblemaGrafo[] };

/** Ids que este nó pode levar a seguir — usado tanto pra alcançabilidade quanto pra detecção de ciclo. */
function proximosDe(no: NoFluxo): string[] {
  switch (no.tipo) {
    case "inicio":
      return [no.proximo];
    case "mensagem":
      return [no.proximo];
    case "espera":
      return [no.proximo];
    case "menu":
      return [...no.opcoes.map((o) => o.proximo), ...(no.proximoTimeout ? [no.proximoTimeout] : [])];
    case "condicao":
      return [no.seVerdadeiro, no.seFalso];
    case "adicionar_etiqueta":
    case "remover_etiqueta":
    case "mudar_status":
    case "marcar_prioridade":
    case "atribuir_atendente":
    case "criar_alerta_interno":
    case "pausar_automacao":
    case "criar_pesquisa":
    case "persistir_resposta_pesquisa":
      return [no.proximo];
    case "capturar_resposta":
      return [no.proximo, ...(no.proximoTimeout ? [no.proximoTimeout] : [])];
    case "finalizar":
    case "transferir_humano":
    case "iniciar_agente_ia":
      return [];
  }
}

/** Nós que "guardam" um ciclo — introduzem espera real (tempo ou input humano), tornando o loop seguro. */
function ehNoDeGuarda(no: NoFluxo): boolean {
  return no.tipo === "espera" || no.tipo === "menu" || no.tipo === "capturar_resposta";
}

/** Nós que terminam a execução — usado pra checar "todo caminho tem uma saída", não só `finalizar` (ver proximosDe). */
function ehNoTerminal(no: NoFluxo): boolean {
  return no.tipo === "finalizar" || no.tipo === "transferir_humano" || no.tipo === "iniciar_agente_ia";
}

export function validarGrafo(definicao: FluxoDefinicao): ResultadoValidacaoGrafo {
  const erros: ProblemaGrafo[] = [];
  const avisos: ProblemaGrafo[] = [];

  const porId = new Map(definicao.nodes.map((n) => [n.id, n] as const));

  // 1. Início único.
  const inicios = definicao.nodes.filter((n) => n.tipo === "inicio");
  if (inicios.length === 0) {
    erros.push({ noIds: [], mensagem: "nenhum nó de início encontrado" });
  } else if (inicios.length > 1) {
    const ids = inicios.map((n) => n.id);
    erros.push({ noIds: ids, mensagem: `mais de um nó de início: ${ids.join(", ")}` });
  }

  // 2. Toda referência aponta pra nó existente.
  for (const no of definicao.nodes) {
    for (const alvo of proximosDe(no)) {
      if (!porId.has(alvo)) {
        erros.push({ noIds: [no.id], mensagem: `nó ${no.id}: aponta pra nó inexistente "${alvo}"` });
      }
    }
  }

  // 2.1. Blocos que referenciam outro registro por id, mas a FORMA tolera
  // vazio (recém-arrastado da paleta, ver fluxo-tipos.ts) — publicar exige.
  for (const no of definicao.nodes) {
    if ((no.tipo === "adicionar_etiqueta" || no.tipo === "remover_etiqueta") && !no.etiquetaId) {
      erros.push({ noIds: [no.id], mensagem: `nó ${no.id}: selecione uma etiqueta` });
    }
    if (no.tipo === "iniciar_agente_ia" && !no.agenteId) {
      erros.push({ noIds: [no.id], mensagem: `nó ${no.id}: selecione um agente de IA` });
    }
    if (no.tipo === "criar_alerta_interno" && !no.numeros.trim()) {
      erros.push({ noIds: [no.id], mensagem: `nó ${no.id}: informe ao menos um número pra alertar` });
    }
  }

  if (erros.length > 0) {
    // Referência quebrada invalida qualquer análise de alcançabilidade/ciclo abaixo — para aqui.
    return { erros, avisos };
  }

  const inicio = encontrarNoInicio(definicao);
  if (!inicio) return { erros, avisos };

  // 3. Alcançabilidade a partir do início (nó órfão = aviso, não erro: pode ser rascunho em progresso).
  const alcancados = new Set<string>();
  const pilha = [inicio.id];
  while (pilha.length > 0) {
    const atualId = pilha.pop()!;
    if (alcancados.has(atualId)) continue;
    alcancados.add(atualId);
    const atual = porId.get(atualId);
    if (!atual) continue;
    for (const alvo of proximosDe(atual)) pilha.push(alvo);
  }
  for (const no of definicao.nodes) {
    if (!alcancados.has(no.id)) {
      avisos.push({ noIds: [no.id], mensagem: `nó ${no.id}: inalcançável a partir do início` });
    }
  }

  // 4. Ao menos um nó terminal alcançável (finalizar, transferir_humano ou
  // iniciar_agente_ia — caminho que sempre termina em algum ponto).
  const terminaisAlcancados = definicao.nodes.filter((n) => ehNoTerminal(n) && alcancados.has(n.id));
  if (terminaisAlcancados.length === 0) {
    avisos.push({ noIds: [], mensagem: "nenhum nó de finalizar alcançável — este fluxo pode nunca terminar" });
  }

  // 5. Ciclo sem nó de guarda (espera/menu) — DFS com pilha de recursão; ao achar
  // um back-edge, o trecho da pilha entre o ancestral e o nó atual É o ciclo.
  const estado = new Map<string, "visitando" | "concluido">();
  const pilhaRecursao: string[] = [];
  const ciclosSemGuardaReportados = new Set<string>();

  function dfs(id: string) {
    estado.set(id, "visitando");
    pilhaRecursao.push(id);

    const no = porId.get(id);
    if (no) {
      for (const alvo of proximosDe(no)) {
        const situacao = estado.get(alvo);
        if (situacao === "visitando") {
          const inicioCiclo = pilhaRecursao.indexOf(alvo);
          const ciclo = pilhaRecursao.slice(inicioCiclo);
          const chave = [...ciclo].sort().join(",");
          if (!ciclosSemGuardaReportados.has(chave)) {
            const temGuarda = ciclo.some((cid) => {
              const cno = porId.get(cid);
              return cno && ehNoDeGuarda(cno);
            });
            if (!temGuarda) {
              ciclosSemGuardaReportados.add(chave);
              erros.push({
                noIds: ciclo,
                mensagem: `loop sem espera/menu de guarda: ${ciclo.join(" → ")} → ${alvo}`,
              });
            }
          }
        } else if (situacao !== "concluido") {
          dfs(alvo);
        }
      }
    }

    pilhaRecursao.pop();
    estado.set(id, "concluido");
  }

  for (const no of definicao.nodes) {
    if (!estado.has(no.id)) dfs(no.id);
  }

  return { erros, avisos };
}
