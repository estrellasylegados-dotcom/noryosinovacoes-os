import { describe, expect, it } from "vitest";
import { calcularPainelNps, classificarNps } from "@/lib/nps";

describe("classificarNps", () => {
  it("classifica os limites exatos da escala 0-6/7-8/9-10", () => {
    expect(classificarNps(0)).toBe("detrator");
    expect(classificarNps(6)).toBe("detrator");
    expect(classificarNps(7)).toBe("neutro");
    expect(classificarNps(8)).toBe("neutro");
    expect(classificarNps(9)).toBe("promotor");
    expect(classificarNps(10)).toBe("promotor");
  });

  it("não classifica fora da faixa 0-10", () => {
    expect(classificarNps(-1)).toBeNull();
    expect(classificarNps(11)).toBeNull();
  });

  it("não classifica número não-inteiro", () => {
    expect(classificarNps(7.5)).toBeNull();
  });
});

describe("calcularPainelNps", () => {
  it("sem pesquisas, tudo zero/null — nunca NaN/Infinity", () => {
    const painel = calcularPainelNps([], []);

    expect(painel.enviadas).toBe(0);
    expect(painel.respondidas).toBe(0);
    expect(painel.taxaResposta).toBeNull();
    expect(painel.scoreNps).toBeNull();
    expect(painel.promotores).toBe(0);
    expect(painel.neutros).toBe(0);
    expect(painel.detratores).toBe(0);
  });

  it("calcula o NPS score clássico ((promotores-detratores)/respondidas*100) com mistura de classificações", () => {
    const pesquisas = [{ status: "respondida" }, { status: "respondida" }, { status: "respondida" }, { status: "respondida" }, { status: "enviada" }];
    const respostas = [
      { classificacao: "promotor" },
      { classificacao: "promotor" },
      { classificacao: "neutro" },
      { classificacao: "detrator" },
    ];

    const painel = calcularPainelNps(pesquisas, respostas);

    expect(painel.enviadas).toBe(5);
    expect(painel.respondidas).toBe(4);
    expect(painel.taxaResposta).toBeCloseTo(0.8);
    expect(painel.promotores).toBe(2);
    expect(painel.neutros).toBe(1);
    expect(painel.detratores).toBe(1);
    expect(painel.scoreNps).toBe(25); // (2-1)/4*100
  });

  it("resposta sem classificacao (nota fora de faixa, ou satisfação misturada) conta em respondidas mas em nenhum balde", () => {
    const pesquisas = [{ status: "respondida" }];
    const respostas = [{ classificacao: null }];

    const painel = calcularPainelNps(pesquisas, respostas);

    expect(painel.respondidas).toBe(1);
    expect(painel.promotores).toBe(0);
    expect(painel.neutros).toBe(0);
    expect(painel.detratores).toBe(0);
    expect(painel.scoreNps).toBe(0);
  });
});
