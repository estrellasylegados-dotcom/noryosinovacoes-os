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
    expect(resultado.erros).toEqual(["nenhum nó de início encontrado"]);
  });

  it("mais de um nó de início: erro nomeando os dois", () => {
    const resultado = validarGrafo(
      def([
        { id: "i1", tipo: "inicio", proximo: "fim" },
        { id: "i2", tipo: "inicio", proximo: "fim" },
        { id: "fim", tipo: "finalizar" },
      ])
    );
    expect(resultado.erros[0]).toContain("i1, i2");
  });

  it("referência pra nó inexistente: erro, sem tentar mais análise", () => {
    const resultado = validarGrafo(def([{ id: "inicio", tipo: "inicio", proximo: "nao_existe" }]));
    expect(resultado.erros).toEqual(['nó inicio: aponta pra nó inexistente "nao_existe"']);
    expect(resultado.avisos).toEqual([]);
  });

  it("nó inalcançável a partir do início: aviso, não erro", () => {
    const resultado = validarGrafo(
      def([
        { id: "inicio", tipo: "inicio", proximo: "fim" },
        { id: "fim", tipo: "finalizar" },
        { id: "solto", tipo: "mensagem", texto: "nunca roda", proximo: "fim" },
      ])
    );
    expect(resultado.erros).toEqual([]);
    expect(resultado.avisos).toContain("nó solto: inalcançável a partir do início");
  });

  it("nenhum finalizar alcançável: aviso de caminho sem fim", () => {
    const resultado = validarGrafo(
      def([
        { id: "inicio", tipo: "inicio", proximo: "espera" },
        { id: "espera", tipo: "espera", duracaoSegundos: 60, proximo: "espera" },
      ])
    );
    expect(resultado.avisos).toContain("nenhum nó de finalizar alcançável — este fluxo pode nunca terminar");
  });

  it("loop de mensagem→condição→mensagem sem espera/menu: erro (loop perigoso)", () => {
    const resultado = validarGrafo(
      def([
        { id: "inicio", tipo: "inicio", proximo: "msg" },
        { id: "msg", tipo: "mensagem", texto: "oi", proximo: "cond" },
        { id: "cond", tipo: "condicao", variavel: "x", operador: "existe", seVerdadeiro: "fim", seFalso: "msg" },
        { id: "fim", tipo: "finalizar" },
      ])
    );
    expect(resultado.erros.some((e) => e.includes("loop sem espera/menu"))).toBe(true);
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
    expect(resultado.erros.some((e) => e.includes("loop"))).toBe(false);
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
    expect(resultado.erros.some((e) => e.includes("loop"))).toBe(false);
  });

  it("auto-loop (nó apontando pra si mesmo) sem guarda: erro", () => {
    const resultado = validarGrafo(
      def([
        { id: "inicio", tipo: "inicio", proximo: "cond" },
        { id: "cond", tipo: "condicao", variavel: "x", operador: "existe", seVerdadeiro: "cond", seFalso: "fim" },
        { id: "fim", tipo: "finalizar" },
      ])
    );
    expect(resultado.erros.some((e) => e.includes("loop"))).toBe(true);
  });
});
