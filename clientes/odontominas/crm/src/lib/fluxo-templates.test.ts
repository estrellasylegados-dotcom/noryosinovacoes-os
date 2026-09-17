import { describe, expect, it } from "vitest";
import { TEMPLATES_ODONTO, buscarTemplate, definicaoPadrao, gerarDefinicaoInicial } from "@/lib/fluxo-templates";
import { validarFormaDefinicao } from "@/lib/fluxo-tipos";
import { validarGrafo } from "@/lib/fluxo-validador";

describe("definicaoPadrao", () => {
  it("passa forma e grafo sem erros nem avisos", () => {
    const definicao = definicaoPadrao();
    expect(validarFormaDefinicao(definicao).ok).toBe(true);
    const grafo = validarGrafo(definicao);
    expect(grafo.erros).toEqual([]);
    expect(grafo.avisos).toEqual([]);
  });
});

describe("TEMPLATES_ODONTO", () => {
  it.each(TEMPLATES_ODONTO)("$nome: passa forma e grafo sem erros (avisos tolerados)", (template) => {
    const definicao = template.gerarDefinicao();
    const forma = validarFormaDefinicao(definicao);
    expect(forma.ok, forma.ok ? "" : (forma as { erro: string }).erro).toBe(true);
    const grafo = validarGrafo(definicao);
    expect(grafo.erros).toEqual([]);
  });

  it.each(TEMPLATES_ODONTO)("$nome: todo nó tem posição de layout gerada", (template) => {
    const definicao = template.gerarDefinicao();
    const layout = (definicao.config as { layout?: { posicoes: Record<string, unknown> } }).layout;
    expect(layout).toBeDefined();
    for (const no of definicao.nodes) {
      expect(layout!.posicoes[no.id]).toBeDefined();
    }
  });

  it("ids de template são únicos", () => {
    const ids = TEMPLATES_ODONTO.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("buscarTemplate / gerarDefinicaoInicial", () => {
  it("buscarTemplate acha por id, null pra id ausente/desconhecido", () => {
    expect(buscarTemplate("atendimento-inicial")?.nome).toBe("Atendimento inicial");
    expect(buscarTemplate("nao-existe")).toBeNull();
    expect(buscarTemplate(null)).toBeNull();
    expect(buscarTemplate(undefined)).toBeNull();
  });

  it("gerarDefinicaoInicial sem templateId cai no padrão em branco", () => {
    const definicao = gerarDefinicaoInicial();
    expect(definicao.nodes).toHaveLength(2);
    expect(definicao.nodes[0]).toMatchObject({ tipo: "inicio" });
  });

  it("gerarDefinicaoInicial com templateId desconhecido também cai no padrão", () => {
    expect(gerarDefinicaoInicial("nao-existe").nodes).toHaveLength(2);
  });

  it("gerarDefinicaoInicial com templateId válido usa o template", () => {
    const definicao = gerarDefinicaoInicial("confirmacao-consulta");
    expect(definicao.nodes.length).toBeGreaterThan(2);
  });
});
