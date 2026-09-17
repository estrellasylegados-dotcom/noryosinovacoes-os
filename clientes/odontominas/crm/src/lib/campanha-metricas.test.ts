import { describe, expect, it } from "vitest";
import { calcularMetricas } from "@/lib/campanha-metricas";

describe("calcularMetricas", () => {
  it("sem investimento registrado, esconde CPL/CPA/CAC/ROAS (item 16 do briefing) mas mantém as taxas", () => {
    const painel = calcularMetricas({
      investimento: null,
      leads: 100,
      respostas: 40,
      qualificados: 20,
      agendamentos: 10,
      comparecimentos: 8,
      fechamentos: 3,
      receita: 9000,
    });

    expect(painel.cpl).toBeNull();
    expect(painel.cpa).toBeNull();
    expect(painel.cac).toBeNull();
    expect(painel.roas).toBeNull();
    expect(painel.investimento).toBeNull();
    expect(painel.taxaResposta).toBeCloseTo(0.4);
    expect(painel.taxaAgendamento).toBeCloseTo(0.1);
    expect(painel.taxaComparecimento).toBeCloseTo(0.8);
    expect(painel.taxaFechamento).toBeCloseTo(0.3);
  });

  it("com investimento > 0, calcula CPL/CPA/CAC/ROAS certos", () => {
    const painel = calcularMetricas({
      investimento: 1000,
      leads: 100,
      respostas: 40,
      qualificados: 20,
      agendamentos: 10,
      comparecimentos: 8,
      fechamentos: 5,
      receita: 5000,
    });

    expect(painel.cpl).toBeCloseTo(10);
    expect(painel.cpa).toBeCloseTo(100);
    expect(painel.cac).toBeCloseTo(200);
    expect(painel.roas).toBeCloseTo(5);
  });

  it("investimento zero conta como 'sem investimento' — nunca divide por zero", () => {
    const painel = calcularMetricas({
      investimento: 0,
      leads: 10,
      respostas: 0,
      qualificados: 0,
      agendamentos: 0,
      comparecimentos: 0,
      fechamentos: 0,
      receita: 0,
    });

    expect(painel.cpl).toBeNull();
    expect(painel.roas).toBeNull();
  });

  it("zero leads/agendamentos: taxas viram null em vez de NaN/Infinity", () => {
    const painel = calcularMetricas({
      investimento: 500,
      leads: 0,
      respostas: 0,
      qualificados: 0,
      agendamentos: 0,
      comparecimentos: 0,
      fechamentos: 0,
      receita: 0,
    });

    expect(painel.taxaResposta).toBeNull();
    expect(painel.taxaAgendamento).toBeNull();
    expect(painel.taxaComparecimento).toBeNull();
    expect(painel.taxaFechamento).toBeNull();
    expect(painel.cpl).toBeNull(); // investimento/0 leads também não faz sentido
    expect(painel.cpa).toBeNull();
    expect(painel.cac).toBeNull();
    expect(Number.isFinite(painel.roas ?? 0)).toBe(true);
  });

  it("preserva as contagens brutas sem alteração", () => {
    const painel = calcularMetricas({
      investimento: 200,
      leads: 7,
      respostas: 3,
      qualificados: 2,
      agendamentos: 1,
      comparecimentos: 1,
      fechamentos: 1,
      receita: 1500,
    });

    expect(painel.leads).toBe(7);
    expect(painel.respostas).toBe(3);
    expect(painel.qualificados).toBe(2);
    expect(painel.agendamentos).toBe(1);
    expect(painel.comparecimentos).toBe(1);
    expect(painel.fechamentos).toBe(1);
    expect(painel.receita).toBe(1500);
  });
});
