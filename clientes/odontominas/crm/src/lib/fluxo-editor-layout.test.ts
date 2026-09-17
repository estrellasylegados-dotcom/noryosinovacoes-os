import { describe, expect, it } from "vitest";
import {
  atualizarPosicaoNo,
  escreverLayoutEditor,
  gerarLayoutAutomatico,
  lerLayoutEditor,
  removerPosicaoNo,
} from "@/lib/fluxo-editor-layout";
import type { NoFluxo } from "@/lib/fluxo-tipos";

describe("lerLayoutEditor", () => {
  it("config sem layout: fallback vazio", () => {
    expect(lerLayoutEditor({})).toEqual({ posicoes: {} });
  });

  it("config.layout malformado (não é objeto): fallback vazio, nunca lança", () => {
    expect(lerLayoutEditor({ layout: "string solta" })).toEqual({ posicoes: {} });
    expect(lerLayoutEditor({ layout: null })).toEqual({ posicoes: {} });
    expect(lerLayoutEditor({ layout: 42 })).toEqual({ posicoes: {} });
  });

  it("lê posições válidas e ignora entradas malformadas", () => {
    const resultado = lerLayoutEditor({
      layout: {
        posicoes: {
          a: { x: 10, y: 20 },
          b: { x: "não é número", y: 5 },
          c: "nem é objeto",
        },
      },
    });
    expect(resultado.posicoes).toEqual({ a: { x: 10, y: 20 } });
  });

  it("viewport válido é preservado; inválido é omitido", () => {
    const comViewport = lerLayoutEditor({ layout: { posicoes: {}, viewport: { x: 1, y: 2, zoom: 0.8 } } });
    expect(comViewport.viewport).toEqual({ x: 1, y: 2, zoom: 0.8 });

    const semViewportValido = lerLayoutEditor({ layout: { posicoes: {}, viewport: { x: 1 } } });
    expect(semViewportValido.viewport).toBeUndefined();
  });
});

describe("escreverLayoutEditor", () => {
  it("preserva outras chaves de config, só substitui 'layout'", () => {
    const config = escreverLayoutEditor({ gatilho: { tipo: "manual" } }, { posicoes: { a: { x: 1, y: 2 } } });
    expect(config).toEqual({ gatilho: { tipo: "manual" }, layout: { posicoes: { a: { x: 1, y: 2 } } } });
  });
});

describe("atualizarPosicaoNo / removerPosicaoNo", () => {
  it("atualiza a posição de um nó sem afetar os outros", () => {
    const layout = atualizarPosicaoNo({ posicoes: { a: { x: 0, y: 0 } } }, "b", { x: 5, y: 5 });
    expect(layout.posicoes).toEqual({ a: { x: 0, y: 0 }, b: { x: 5, y: 5 } });
  });

  it("remove a posição de um nó", () => {
    const layout = removerPosicaoNo({ posicoes: { a: { x: 0, y: 0 }, b: { x: 5, y: 5 } } }, "a");
    expect(layout.posicoes).toEqual({ b: { x: 5, y: 5 } });
  });
});

describe("gerarLayoutAutomatico", () => {
  it("cadeia linear: cada nó num nível (x) crescente, mesma coluna (y=0)", () => {
    const nodes: NoFluxo[] = [
      { id: "inicio", tipo: "inicio", proximo: "msg" },
      { id: "msg", tipo: "mensagem", texto: "oi", proximo: "fim" },
      { id: "fim", tipo: "finalizar" },
    ];
    const posicoes = gerarLayoutAutomatico(nodes);
    expect(posicoes.inicio.x).toBeLessThan(posicoes.msg.x);
    expect(posicoes.msg.x).toBeLessThan(posicoes.fim.x);
    expect(posicoes.inicio.y).toBe(0);
    expect(posicoes.msg.y).toBe(0);
  });

  it("ramificação (menu com 2 opções): mesmo nível, y diferentes", () => {
    const nodes: NoFluxo[] = [
      { id: "inicio", tipo: "inicio", proximo: "menu" },
      {
        id: "menu",
        tipo: "menu",
        texto: "Escolha",
        opcoes: [
          { valor: "1", rotulos: ["1"], proximo: "a" },
          { valor: "2", rotulos: ["2"], proximo: "b" },
        ],
      },
      { id: "a", tipo: "finalizar" },
      { id: "b", tipo: "finalizar" },
    ];
    const posicoes = gerarLayoutAutomatico(nodes);
    expect(posicoes.a.x).toBe(posicoes.b.x);
    expect(posicoes.a.y).not.toBe(posicoes.b.y);
  });

  it("nó órfão (inalcançável a partir do início) ainda ganha uma posição, sem lançar", () => {
    const nodes: NoFluxo[] = [
      { id: "inicio", tipo: "inicio", proximo: "fim" },
      { id: "fim", tipo: "finalizar" },
      { id: "solto", tipo: "mensagem", texto: "nunca roda", proximo: "fim" },
    ];
    expect(() => gerarLayoutAutomatico(nodes)).not.toThrow();
    const posicoes = gerarLayoutAutomatico(nodes);
    expect(posicoes.solto).toBeDefined();
  });

  it("lista vazia: não lança, devolve objeto vazio", () => {
    expect(gerarLayoutAutomatico([])).toEqual({});
  });
});
