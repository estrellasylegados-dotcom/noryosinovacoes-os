import { describe, expect, it } from "vitest";
import { calcularPainelReputacao } from "@/lib/reputacao-metricas";

describe("calcularPainelReputacao", () => {
  it("sem solicitações, tudo zero/null — nunca NaN/Infinity", () => {
    const painel = calcularPainelReputacao([]);

    expect(painel.total).toBe(0);
    expect(painel.enviadas).toBe(0);
    expect(painel.clicadas).toBe(0);
    expect(painel.falhas).toBe(0);
    expect(painel.taxaClique).toBeNull();
  });

  it("taxa de clique exclui falhas do denominador (item 23 da visão)", () => {
    const pesquisas = [
      { status: "clicada" },
      { status: "clicada" },
      { status: "enviada" },
      { status: "enviada" },
      { status: "falhou" },
    ];

    const painel = calcularPainelReputacao(pesquisas);

    expect(painel.total).toBe(5);
    expect(painel.falhas).toBe(1);
    expect(painel.clicadas).toBe(2);
    expect(painel.enviadas).toBe(4); // 5 - 1 falha, NUNCA 5
    expect(painel.taxaClique).toBeCloseTo(0.5); // 2/4, não 2/5
  });

  it("todas falharam: enviadas=0, taxa null (não zero/Infinity)", () => {
    const painel = calcularPainelReputacao([{ status: "falhou" }, { status: "falhou" }]);

    expect(painel.enviadas).toBe(0);
    expect(painel.taxaClique).toBeNull();
  });
});
