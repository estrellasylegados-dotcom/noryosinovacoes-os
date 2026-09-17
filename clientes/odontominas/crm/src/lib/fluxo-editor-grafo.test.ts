import { describe, expect, it } from "vitest";
import {
  adicionarNo,
  adicionarOpcaoMenu,
  aplicarConexao,
  atualizarNo,
  criarNoPadrao,
  derivarArestasXyflow,
  limparConectorOpcional,
  podeDeletarAresta,
  removerNo,
  removerOpcaoMenu,
} from "@/lib/fluxo-editor-grafo";
import { validarFormaDefinicao } from "@/lib/fluxo-tipos";
import type { NoCondicao, NoMenu } from "@/lib/fluxo-tipos";

describe("criarNoPadrao", () => {
  it.each([
    "inicio",
    "mensagem",
    "espera",
    "menu",
    "condicao",
    "finalizar",
    "adicionar_etiqueta",
    "remover_etiqueta",
    "mudar_status",
    "marcar_prioridade",
    "atribuir_atendente",
  ] as const)("tipo %s nasce sintaticamente válido (passa validarFormaDefinicao)", (tipo) => {
    const no = criarNoPadrao(tipo, "novo");
    const resultado = validarFormaDefinicao({ nodes: [no], edges: [], config: {} });
    expect(resultado.ok).toBe(true);
  });

  it("nasce auto-referenciado quando tem destino", () => {
    expect(criarNoPadrao("mensagem", "m1")).toMatchObject({ proximo: "m1" });
    expect(criarNoPadrao("espera", "e1")).toMatchObject({ proximo: "e1" });
    const cond = criarNoPadrao("condicao", "c1") as NoCondicao;
    expect(cond.seVerdadeiro).toBe("c1");
    expect(cond.seFalso).toBe("c1");
  });

  it("Ações CRM nascem auto-referenciadas, etiqueta vazia (tolerada na forma, barrada só na publicação)", () => {
    expect(criarNoPadrao("adicionar_etiqueta", "a1")).toMatchObject({ etiquetaId: "", proximo: "a1" });
    expect(criarNoPadrao("remover_etiqueta", "r1")).toMatchObject({ etiquetaId: "", proximo: "r1" });
    expect(criarNoPadrao("mudar_status", "s1")).toMatchObject({ status: "respondido", proximo: "s1" });
    expect(criarNoPadrao("marcar_prioridade", "p1")).toMatchObject({ prioridade: "normal", proximo: "p1" });
    expect(criarNoPadrao("atribuir_atendente", "at1")).toMatchObject({ atendenteId: null, proximo: "at1" });
  });
});

describe("derivarArestasXyflow", () => {
  it("inicio/mensagem/espera: 1 aresta 'default'", () => {
    const arestas = derivarArestasXyflow([{ id: "i", tipo: "inicio", proximo: "m" }]);
    expect(arestas).toEqual([{ id: "i::default", source: "i", sourceHandle: "default", target: "m" }]);
  });

  it("condicao: 2 arestas, verdadeiro e falso", () => {
    const arestas = derivarArestasXyflow([
      { id: "c", tipo: "condicao", variavel: "x", operador: "existe", seVerdadeiro: "a", seFalso: "b" },
    ]);
    expect(arestas).toEqual([
      { id: "c::verdadeiro", source: "c", sourceHandle: "verdadeiro", target: "a" },
      { id: "c::falso", source: "c", sourceHandle: "falso", target: "b" },
    ]);
  });

  it("finalizar: 0 arestas", () => {
    expect(derivarArestasXyflow([{ id: "f", tipo: "finalizar" }])).toEqual([]);
  });

  it("menu: 1 aresta por opção + timeout só se definido", () => {
    const menuSemTimeout: NoMenu = {
      id: "m",
      tipo: "menu",
      texto: "Escolha",
      opcoes: [
        { valor: "1", rotulos: ["1"], proximo: "a" },
        { valor: "2", rotulos: ["2"], proximo: "b" },
      ],
    };
    expect(derivarArestasXyflow([menuSemTimeout])).toEqual([
      { id: "m::opcao:0", source: "m", sourceHandle: "opcao:0", target: "a" },
      { id: "m::opcao:1", source: "m", sourceHandle: "opcao:1", target: "b" },
    ]);

    const menuComTimeout: NoMenu = { ...menuSemTimeout, proximoTimeout: "timeout_no" };
    const arestas = derivarArestasXyflow([menuComTimeout]);
    expect(arestas).toContainEqual({ id: "m::timeout", source: "m", sourceHandle: "timeout", target: "timeout_no" });
  });

  it("Ações CRM: 1 aresta 'default', mesmo padrão de mensagem/espera", () => {
    expect(derivarArestasXyflow([{ id: "et", tipo: "adicionar_etiqueta", etiquetaId: "x", proximo: "fim" }])).toEqual([
      { id: "et::default", source: "et", sourceHandle: "default", target: "fim" },
    ]);
    expect(derivarArestasXyflow([{ id: "at", tipo: "atribuir_atendente", atendenteId: null, proximo: "fim" }])).toEqual([
      { id: "at::default", source: "at", sourceHandle: "default", target: "fim" },
    ]);
  });

  it("duas opções de menu apontando pro mesmo destino geram 2 arestas com ids distintos", () => {
    const menu: NoMenu = {
      id: "m",
      tipo: "menu",
      texto: "Escolha",
      opcoes: [
        { valor: "1", rotulos: ["1"], proximo: "fim" },
        { valor: "2", rotulos: ["2"], proximo: "fim" },
      ],
    };
    const arestas = derivarArestasXyflow([menu]);
    expect(arestas).toHaveLength(2);
    expect(new Set(arestas.map((a) => a.id)).size).toBe(2);
  });
});

describe("aplicarConexao", () => {
  it("mensagem: reconecta 'default'", () => {
    const nodes = aplicarConexao([{ id: "m", tipo: "mensagem", texto: "oi", proximo: "m" }], "m", "default", "fim");
    expect(nodes[0]).toMatchObject({ proximo: "fim" });
  });

  it("condicao: reconecta 'verdadeiro' e 'falso' independentemente", () => {
    let nodes = aplicarConexao(
      [{ id: "c", tipo: "condicao", variavel: "x", operador: "existe", seVerdadeiro: "c", seFalso: "c" }],
      "c",
      "verdadeiro",
      "a"
    );
    nodes = aplicarConexao(nodes, "c", "falso", "b");
    expect(nodes[0]).toMatchObject({ seVerdadeiro: "a", seFalso: "b" });
  });

  it("menu: reconecta a opção certa por índice, sem afetar as outras", () => {
    const menu: NoMenu = {
      id: "m",
      tipo: "menu",
      texto: "Escolha",
      opcoes: [
        { valor: "1", rotulos: ["1"], proximo: "m" },
        { valor: "2", rotulos: ["2"], proximo: "m" },
      ],
    };
    const nodes = aplicarConexao([menu], "m", "opcao:1", "fim") as [NoMenu];
    expect(nodes[0].opcoes[0].proximo).toBe("m");
    expect(nodes[0].opcoes[1].proximo).toBe("fim");
  });

  it("menu: conecta o handle 'timeout' em proximoTimeout", () => {
    const menu: NoMenu = { id: "m", tipo: "menu", texto: "Escolha", opcoes: [{ valor: "1", rotulos: ["1"], proximo: "m" }] };
    const nodes = aplicarConexao([menu], "m", "timeout", "fim") as [NoMenu];
    expect(nodes[0].proximoTimeout).toBe("fim");
  });

  it("finalizar: nunca muta (não tem conector de saída)", () => {
    const nodes = aplicarConexao([{ id: "f", tipo: "finalizar" }], "f", "default", "x");
    expect(nodes[0]).toEqual({ id: "f", tipo: "finalizar" });
  });

  it("Ações CRM: reconecta 'default', mesmo padrão de mensagem/espera", () => {
    const nodes = aplicarConexao([{ id: "st", tipo: "mudar_status", status: "respondido", proximo: "st" }], "st", "default", "fim");
    expect(nodes[0]).toMatchObject({ proximo: "fim" });
  });

  it("nó de outro id não é afetado", () => {
    const nodes = aplicarConexao(
      [
        { id: "m1", tipo: "mensagem", texto: "a", proximo: "m1" },
        { id: "m2", tipo: "mensagem", texto: "b", proximo: "m2" },
      ],
      "m1",
      "default",
      "fim"
    );
    expect(nodes[1]).toMatchObject({ proximo: "m2" });
  });
});

describe("podeDeletarAresta / limparConectorOpcional", () => {
  const menu: NoMenu = {
    id: "m",
    tipo: "menu",
    texto: "Escolha",
    opcoes: [{ valor: "1", rotulos: ["1"], proximo: "m" }],
    proximoTimeout: "fim",
  };

  it("só o timeout do menu é deletável", () => {
    expect(podeDeletarAresta(menu, "timeout")).toBe(true);
    expect(podeDeletarAresta(menu, "opcao:0")).toBe(false);
    expect(podeDeletarAresta({ id: "ms", tipo: "mensagem", texto: "x", proximo: "ms" }, "default")).toBe(false);
  });

  it("limparConectorOpcional remove proximoTimeout e nada mais", () => {
    const limpo = limparConectorOpcional(menu, "timeout") as NoMenu;
    expect(limpo.proximoTimeout).toBeUndefined();
    expect(limpo.opcoes).toEqual(menu.opcoes);
  });
});

describe("adicionarOpcaoMenu / removerOpcaoMenu", () => {
  it("adiciona opção auto-referenciada", () => {
    const menu: NoMenu = { id: "m", tipo: "menu", texto: "Escolha", opcoes: [{ valor: "1", rotulos: ["1"], proximo: "fim" }] };
    const atualizado = adicionarOpcaoMenu(menu);
    expect(atualizado.opcoes).toHaveLength(2);
    expect(atualizado.opcoes[1]).toMatchObject({ valor: "2", proximo: "m" });
  });

  it("remove opção por índice", () => {
    const menu: NoMenu = {
      id: "m",
      tipo: "menu",
      texto: "Escolha",
      opcoes: [
        { valor: "1", rotulos: ["1"], proximo: "a" },
        { valor: "2", rotulos: ["2"], proximo: "b" },
      ],
    };
    const atualizado = removerOpcaoMenu(menu, 0);
    expect(atualizado.opcoes).toEqual([{ valor: "2", rotulos: ["2"], proximo: "b" }]);
  });

  it("nunca remove a última opção", () => {
    const menu: NoMenu = { id: "m", tipo: "menu", texto: "Escolha", opcoes: [{ valor: "1", rotulos: ["1"], proximo: "fim" }] };
    expect(removerOpcaoMenu(menu, 0)).toBe(menu);
  });
});

describe("atualizarNo / removerNo / adicionarNo", () => {
  it("atualizarNo substitui só o nó com o id certo", () => {
    const nodes = atualizarNo(
      [
        { id: "a", tipo: "finalizar" },
        { id: "b", tipo: "finalizar" },
      ],
      "a",
      { id: "a", tipo: "finalizar", motivo: "x" }
    );
    expect(nodes[0]).toMatchObject({ motivo: "x" });
    expect(nodes[1]).toEqual({ id: "b", tipo: "finalizar" });
  });

  it("removerNo tira o nó da lista, referências soltas ficam soltas de propósito", () => {
    const nodes = removerNo(
      [
        { id: "a", tipo: "mensagem", texto: "x", proximo: "b" },
        { id: "b", tipo: "finalizar" },
      ],
      "b"
    );
    expect(nodes).toEqual([{ id: "a", tipo: "mensagem", texto: "x", proximo: "b" }]);
  });

  it("adicionarNo acrescenta no fim", () => {
    const nodes = adicionarNo([{ id: "a", tipo: "finalizar" }], { id: "b", tipo: "finalizar" });
    expect(nodes).toHaveLength(2);
    expect(nodes[1]).toEqual({ id: "b", tipo: "finalizar" });
  });
});
