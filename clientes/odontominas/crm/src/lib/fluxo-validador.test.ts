import { describe, expect, it } from "vitest";
import { validarGrafo } from "@/lib/fluxo-validador";
import type { FluxoDefinicao } from "@/lib/fluxo-tipos";

function def(nodes: FluxoDefinicao["nodes"]): FluxoDefinicao {
  return { nodes, edges: [], config: {} };
}

describe("validarGrafo", () => {
  it("fluxo simples e válido: início → mensagem → finalizar, sem erro nem aviso", () => {
    const resultado = validarGrafo(
      def([
        { id: "inicio", tipo: "inicio", proximo: "msg" },
        { id: "msg", tipo: "mensagem", texto: "Oi", proximo: "fim" },
        { id: "fim", tipo: "finalizar" },
      ])
    );
    expect(resultado.erros).toEqual([]);
    expect(resultado.avisos).toEqual([]);
  });

  it("sem nó de início: erro", () => {
    const resultado = validarGrafo(def([{ id: "fim", tipo: "finalizar" }]));
    expect(resultado.erros).toEqual([{ noIds: [], mensagem: "nenhum nó de início encontrado" }]);
  });

  it("mais de um nó de início: erro nomeando os dois, noIds com ambos", () => {
    const resultado = validarGrafo(
      def([
        { id: "i1", tipo: "inicio", proximo: "fim" },
        { id: "i2", tipo: "inicio", proximo: "fim" },
        { id: "fim", tipo: "finalizar" },
      ])
    );
    expect(resultado.erros[0].mensagem).toContain("i1, i2");
    expect(resultado.erros[0].noIds).toEqual(["i1", "i2"]);
  });

  it("referência pra nó inexistente: erro, sem tentar mais análise, noIds aponta o nó de origem", () => {
    const resultado = validarGrafo(def([{ id: "inicio", tipo: "inicio", proximo: "nao_existe" }]));
    expect(resultado.erros).toEqual([
      { noIds: ["inicio"], mensagem: 'nó inicio: aponta pra nó inexistente "nao_existe"' },
    ]);
    expect(resultado.avisos).toEqual([]);
  });

  it("nó inalcançável a partir do início: aviso, não erro, noIds aponta o nó solto", () => {
    const resultado = validarGrafo(
      def([
        { id: "inicio", tipo: "inicio", proximo: "fim" },
        { id: "fim", tipo: "finalizar" },
        { id: "solto", tipo: "mensagem", texto: "nunca roda", proximo: "fim" },
      ])
    );
    expect(resultado.erros).toEqual([]);
    expect(resultado.avisos).toContainEqual({ noIds: ["solto"], mensagem: "nó solto: inalcançável a partir do início" });
  });

  it("nenhum finalizar alcançável: aviso de caminho sem fim", () => {
    const resultado = validarGrafo(
      def([
        { id: "inicio", tipo: "inicio", proximo: "espera" },
        { id: "espera", tipo: "espera", duracaoSegundos: 60, proximo: "espera" },
      ])
    );
    expect(resultado.avisos).toContainEqual({
      noIds: [],
      mensagem: "nenhum nó de finalizar alcançável — este fluxo pode nunca terminar",
    });
  });

  it("loop de mensagem→condição→mensagem sem espera/menu: erro (loop perigoso), noIds com o ciclo", () => {
    const resultado = validarGrafo(
      def([
        { id: "inicio", tipo: "inicio", proximo: "msg" },
        { id: "msg", tipo: "mensagem", texto: "oi", proximo: "cond" },
        { id: "cond", tipo: "condicao", variavel: "x", operador: "existe", seVerdadeiro: "fim", seFalso: "msg" },
        { id: "fim", tipo: "finalizar" },
      ])
    );
    const erroLoop = resultado.erros.find((e) => e.mensagem.includes("loop sem espera/menu"));
    expect(erroLoop).toBeDefined();
    expect(erroLoop?.noIds.sort()).toEqual(["cond", "msg"]);
  });

  it("loop passando por um nó de espera: permitido, sem erro de loop", () => {
    const resultado = validarGrafo(
      def([
        { id: "inicio", tipo: "inicio", proximo: "espera" },
        { id: "espera", tipo: "espera", duracaoSegundos: 3600, proximo: "cond" },
        { id: "cond", tipo: "condicao", variavel: "x", operador: "existe", seVerdadeiro: "fim", seFalso: "espera" },
        { id: "fim", tipo: "finalizar" },
      ])
    );
    expect(resultado.erros.some((e) => e.mensagem.includes("loop"))).toBe(false);
  });

  it("loop passando por um nó de menu: permitido, sem erro de loop", () => {
    const resultado = validarGrafo(
      def([
        { id: "inicio", tipo: "inicio", proximo: "menu" },
        {
          id: "menu",
          tipo: "menu",
          texto: "Escolha",
          opcoes: [
            { valor: "1", rotulos: ["1"], proximo: "menu" },
            { valor: "2", rotulos: ["2"], proximo: "fim" },
          ],
        },
        { id: "fim", tipo: "finalizar" },
      ])
    );
    expect(resultado.erros.some((e) => e.mensagem.includes("loop"))).toBe(false);
  });

  it("Ações CRM válidas (etiqueta escolhida): sem erro", () => {
    const resultado = validarGrafo(
      def([
        { id: "inicio", tipo: "inicio", proximo: "et" },
        { id: "et", tipo: "adicionar_etiqueta", etiquetaId: "etq-1", proximo: "fim" },
        { id: "fim", tipo: "finalizar" },
      ])
    );
    expect(resultado.erros).toEqual([]);
  });

  it("adicionar_etiqueta sem etiqueta escolhida (etiquetaId vazio): erro bloqueia publicação", () => {
    const resultado = validarGrafo(
      def([
        { id: "inicio", tipo: "inicio", proximo: "et" },
        { id: "et", tipo: "adicionar_etiqueta", etiquetaId: "", proximo: "fim" },
        { id: "fim", tipo: "finalizar" },
      ])
    );
    expect(resultado.erros).toContainEqual({ noIds: ["et"], mensagem: "nó et: selecione uma etiqueta" });
  });

  it("remover_etiqueta sem etiqueta escolhida: mesmo erro", () => {
    const resultado = validarGrafo(
      def([
        { id: "inicio", tipo: "inicio", proximo: "et" },
        { id: "et", tipo: "remover_etiqueta", etiquetaId: "", proximo: "fim" },
        { id: "fim", tipo: "finalizar" },
      ])
    );
    expect(resultado.erros).toContainEqual({ noIds: ["et"], mensagem: "nó et: selecione uma etiqueta" });
  });

  it("mudar_status/marcar_prioridade/atribuir_atendente em loop sem guarda: mesmo erro de loop perigoso que qualquer outro nó de passagem", () => {
    const resultado = validarGrafo(
      def([
        { id: "inicio", tipo: "inicio", proximo: "st" },
        { id: "st", tipo: "mudar_status", status: "respondido", proximo: "pr" },
        { id: "pr", tipo: "marcar_prioridade", prioridade: "alta", proximo: "st" },
      ])
    );
    const erroLoop = resultado.erros.find((e) => e.mensagem.includes("loop sem espera/menu"));
    expect(erroLoop).toBeDefined();
    expect(erroLoop?.noIds.sort()).toEqual(["pr", "st"]);
  });

  it("auto-loop (nó apontando pra si mesmo) sem guarda: erro, noIds com o próprio nó", () => {
    const resultado = validarGrafo(
      def([
        { id: "inicio", tipo: "inicio", proximo: "cond" },
        { id: "cond", tipo: "condicao", variavel: "x", operador: "existe", seVerdadeiro: "cond", seFalso: "fim" },
        { id: "fim", tipo: "finalizar" },
      ])
    );
    const erroLoop = resultado.erros.find((e) => e.mensagem.includes("loop"));
    expect(erroLoop).toBeDefined();
    expect(erroLoop?.noIds).toEqual(["cond"]);
  });
});
