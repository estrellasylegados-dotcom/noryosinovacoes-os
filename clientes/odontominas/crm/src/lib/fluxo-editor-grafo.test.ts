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
import type { NoCapturarResposta, NoCondicao, NoMenu } from "@/lib/fluxo-tipos";
import { validarGrafo } from "@/lib/fluxo-validador";

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
    "transferir_humano",
    "criar_alerta_interno",
    "pausar_automacao",
    "iniciar_agente_ia",
    "capturar_resposta",
    "criar_pesquisa",
    "persistir_resposta_pesquisa",
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

  it("Humano + IA: os 2 passthrough nascem auto-referenciados; os 2 terminais nascem sem proximo (mesmo desenho de finalizar)", () => {
    expect(criarNoPadrao("criar_alerta_interno", "al1")).toMatchObject({ mensagem: "Alerta interno do fluxo.", numeros: "", proximo: "al1" });
    expect(criarNoPadrao("pausar_automacao", "pa1")).toMatchObject({ proximo: "pa1" });
    expect(criarNoPadrao("transferir_humano", "th1")).toEqual({ id: "th1", tipo: "transferir_humano" });
    expect(criarNoPadrao("iniciar_agente_ia", "ia1")).toEqual({ id: "ia1", tipo: "iniciar_agente_ia", agenteId: "" });
  });

  it("capturar_resposta nasce auto-referenciado, tipoValor texto (Fase 3)", () => {
    expect(criarNoPadrao("capturar_resposta", "cap1")).toMatchObject({
      tipo: "capturar_resposta",
      tipoValor: "texto",
      proximo: "cap1",
    });
  });

  it("criar_pesquisa nasce auto-referenciado, tipo nps por padrão (Fase 3)", () => {
    expect(criarNoPadrao("criar_pesquisa", "cp1")).toMatchObject({
      tipo: "criar_pesquisa",
      tipoPesquisa: "nps",
      variavelDestino: "pesquisa_id",
      proximo: "cp1",
    });
  });

  it("persistir_resposta_pesquisa nasce auto-referenciado (Fase 3)", () => {
    expect(criarNoPadrao("persistir_resposta_pesquisa", "pp1")).toMatchObject({
      tipo: "persistir_resposta_pesquisa",
      variavelPesquisaId: "pesquisa_id",
      proximo: "pp1",
    });
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

  it("finalizar/transferir_humano/iniciar_agente_ia: 0 arestas (terminais)", () => {
    expect(derivarArestasXyflow([{ id: "f", tipo: "finalizar" }])).toEqual([]);
    expect(derivarArestasXyflow([{ id: "th", tipo: "transferir_humano" }])).toEqual([]);
    expect(derivarArestasXyflow([{ id: "ia", tipo: "iniciar_agente_ia", agenteId: "a1" }])).toEqual([]);
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

  it("criar_alerta_interno/pausar_automacao: 1 aresta 'default', mesmo padrão de mensagem/espera", () => {
    expect(derivarArestasXyflow([{ id: "al", tipo: "criar_alerta_interno", mensagem: "oi", numeros: "1", proximo: "fim" }])).toEqual([
      { id: "al::default", source: "al", sourceHandle: "default", target: "fim" },
    ]);
    expect(derivarArestasXyflow([{ id: "pa", tipo: "pausar_automacao", proximo: "fim" }])).toEqual([
      { id: "pa::default", source: "pa", sourceHandle: "default", target: "fim" },
    ]);
  });

  it("capturar_resposta: 1 aresta 'default' + timeout só se definido (mesmo padrão de menu)", () => {
    const semTimeout: NoCapturarResposta = { id: "cap", tipo: "capturar_resposta", texto: "?", variavel: "x", tipoValor: "texto", proximo: "fim" };
    expect(derivarArestasXyflow([semTimeout])).toEqual([{ id: "cap::default", source: "cap", sourceHandle: "default", target: "fim" }]);

    const comTimeout: NoCapturarResposta = { ...semTimeout, proximoTimeout: "timeout_no" };
    const arestas = derivarArestasXyflow([comTimeout]);
    expect(arestas).toContainEqual({ id: "cap::timeout", source: "cap", sourceHandle: "timeout", target: "timeout_no" });
  });

  it("criar_pesquisa/persistir_resposta_pesquisa: 1 aresta 'default', mesmo padrão de mensagem/espera", () => {
    expect(derivarArestasXyflow([{ id: "cp", tipo: "criar_pesquisa", tipoPesquisa: "nps", variavelDestino: "x", proximo: "fim" }])).toEqual([
      { id: "cp::default", source: "cp", sourceHandle: "default", target: "fim" },
    ]);
    expect(
      derivarArestasXyflow([
        { id: "pp", tipo: "persistir_resposta_pesquisa", variavelPesquisaId: "x", variavelValor: "y", proximo: "fim" },
      ])
    ).toEqual([{ id: "pp::default", source: "pp", sourceHandle: "default", target: "fim" }]);
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

  it("finalizar/transferir_humano/iniciar_agente_ia: nunca mutam (terminais, sem conector de saída)", () => {
    expect(aplicarConexao([{ id: "f", tipo: "finalizar" }], "f", "default", "x")[0]).toEqual({ id: "f", tipo: "finalizar" });
    expect(aplicarConexao([{ id: "th", tipo: "transferir_humano" }], "th", "default", "x")[0]).toEqual({ id: "th", tipo: "transferir_humano" });
    expect(aplicarConexao([{ id: "ia", tipo: "iniciar_agente_ia", agenteId: "a1" }], "ia", "default", "x")[0]).toEqual({
      id: "ia",
      tipo: "iniciar_agente_ia",
      agenteId: "a1",
    });
  });

  it("Ações CRM: reconecta 'default', mesmo padrão de mensagem/espera", () => {
    const nodes = aplicarConexao([{ id: "st", tipo: "mudar_status", status: "respondido", proximo: "st" }], "st", "default", "fim");
    expect(nodes[0]).toMatchObject({ proximo: "fim" });
  });

  it("criar_alerta_interno/pausar_automacao: reconecta 'default', mesmo padrão de mensagem/espera", () => {
    const nodes = aplicarConexao([{ id: "pa", tipo: "pausar_automacao", proximo: "pa" }], "pa", "default", "fim");
    expect(nodes[0]).toMatchObject({ proximo: "fim" });
  });

  it("capturar_resposta: reconecta 'default' e 'timeout' independentemente", () => {
    const cap: NoCapturarResposta = { id: "cap", tipo: "capturar_resposta", texto: "?", variavel: "x", tipoValor: "texto", proximo: "cap" };
    let nodes = aplicarConexao([cap], "cap", "default", "fim");
    expect(nodes[0]).toMatchObject({ proximo: "fim" });
    nodes = aplicarConexao(nodes, "cap", "timeout", "timeout_no");
    expect(nodes[0]).toMatchObject({ proximoTimeout: "timeout_no", proximo: "fim" });
  });

  it("criar_pesquisa/persistir_resposta_pesquisa: reconecta 'default', mesmo padrão de mensagem/espera", () => {
    const nodes = aplicarConexao(
      [{ id: "cp", tipo: "criar_pesquisa", tipoPesquisa: "nps", variavelDestino: "x", proximo: "cp" }],
      "cp",
      "default",
      "fim"
    );
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

  it("timeout de capturar_resposta também é deletável (Fase 3, mesmo padrão de menu)", () => {
    const cap: NoCapturarResposta = {
      id: "cap",
      tipo: "capturar_resposta",
      texto: "?",
      variavel: "x",
      tipoValor: "texto",
      proximo: "fim",
      proximoTimeout: "timeout_no",
    };
    expect(podeDeletarAresta(cap, "timeout")).toBe(true);
    expect(podeDeletarAresta(cap, "default")).toBe(false);
    expect((limparConectorOpcional(cap, "timeout") as NoCapturarResposta).proximoTimeout).toBeUndefined();
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

describe("Fase 3 — serialização (salvar/reabrir) e compatibilidade com fluxo antigo", () => {
  it("capturar_resposta/criar_pesquisa/persistir_resposta_pesquisa sobrevivem a um round-trip JSON (mesmo formato salvo em fluxo_versoes.definicao)", () => {
    const nodes = [
      criarNoPadrao("inicio", "inicio"),
      { ...(criarNoPadrao("capturar_resposta", "cap") as NoCapturarResposta), min: 0, max: 10, tipoValor: "numero" as const },
      criarNoPadrao("criar_pesquisa", "cp"),
      criarNoPadrao("persistir_resposta_pesquisa", "pp"),
      { id: "fim", tipo: "finalizar" as const },
    ];
    const bruto = { nodes, edges: [], config: {} };
    const depoisDeSalvarEReabrir = JSON.parse(JSON.stringify(bruto));
    const resultado = validarFormaDefinicao(depoisDeSalvarEReabrir);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect(resultado.definicao.nodes).toEqual(nodes);
  });

  it("um fluxo antigo (só nós que já existiam antes da Fase 3) continua validando normalmente — nada quebrou", () => {
    const fluxoAntigo = {
      nodes: [
        { id: "inicio", tipo: "inicio", proximo: "msg" },
        { id: "msg", tipo: "mensagem", texto: "Oi {primeiro_nome}!", proximo: "menu" },
        {
          id: "menu",
          tipo: "menu",
          texto: "1 Agendar\n2 Falar com atendente",
          opcoes: [
            { valor: "agendar", rotulos: ["1"], proximo: "et" },
            { valor: "atendente", rotulos: ["2"], proximo: "th" },
          ],
        },
        { id: "et", tipo: "adicionar_etiqueta", etiquetaId: "etq-1", proximo: "fim" },
        { id: "th", tipo: "transferir_humano" },
        { id: "fim", tipo: "finalizar" },
      ],
      edges: [],
      config: {},
    };
    const resultado = validarFormaDefinicao(fluxoAntigo);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      const grafo = validarGrafo(resultado.definicao);
      expect(grafo.erros).toEqual([]);
    }
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
