import { describe, expect, it } from "vitest";
import { avaliarStatusPorMinutos, mediana, validarSlaConfig } from "@/lib/sla";

describe("avaliarStatusPorMinutos", () => {
  const LIMITE = 15;
  const ALERTA = 80; // seção 41: threshold 80%

  it("0-11 min de 15 (< 80%) → ok", () => {
    expect(avaliarStatusPorMinutos(0, LIMITE, ALERTA, true, true)).toBe("ok");
    expect(avaliarStatusPorMinutos(11, LIMITE, ALERTA, true, true)).toBe("ok");
  });

  it("12-14 min de 15 (>= 80% e < 100%) → warning", () => {
    expect(avaliarStatusPorMinutos(12, LIMITE, ALERTA, true, true)).toBe("warning");
    expect(avaliarStatusPorMinutos(14, LIMITE, ALERTA, true, true)).toBe("warning");
  });

  it("15+ min de 15 (>= 100%) → breached", () => {
    expect(avaliarStatusPorMinutos(15, LIMITE, ALERTA, true, true)).toBe("breached");
    expect(avaliarStatusPorMinutos(30, LIMITE, ALERTA, true, true)).toBe("breached");
  });

  it("fora do horário de atendimento, ainda não estourou → paused (não warning/ok)", () => {
    expect(avaliarStatusPorMinutos(5, LIMITE, ALERTA, false, true)).toBe("paused");
  });

  it("já estourou antes de fechar: continua breached mesmo fora do horário agora (fato do passado não se apaga)", () => {
    expect(avaliarStatusPorMinutos(20, LIMITE, ALERTA, false, true)).toBe("breached");
  });

  it("SLA em minutos corridos (respeitaHorario=false) nunca pausa, mesmo fora do horário", () => {
    expect(avaliarStatusPorMinutos(5, LIMITE, ALERTA, false, false)).toBe("ok");
    expect(avaliarStatusPorMinutos(13, LIMITE, ALERTA, false, false)).toBe("warning");
  });
});

describe("mediana", () => {
  it("lista vazia → null", () => {
    expect(mediana([])).toBeNull();
  });

  it("ímpar → elemento do meio", () => {
    expect(mediana([5, 1, 3])).toBe(3);
  });

  it("par → média dos 2 do meio", () => {
    expect(mediana([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("validarSlaConfig", () => {
  const base = { ativo: true, primeiraRespostaMinutos: 15, respostaAtendimentoMinutos: 30, alertaPercentual: 80, considerarApenasHorarioUtil: true };

  it("aceita config válida", () => {
    expect(validarSlaConfig(base)).toBeNull();
  });

  it("rejeita primeira resposta <= 0", () => {
    expect(validarSlaConfig({ ...base, primeiraRespostaMinutos: 0 })).toBe("primeira_resposta_invalida");
  });

  it("rejeita resposta em atendimento <= 0", () => {
    expect(validarSlaConfig({ ...base, respostaAtendimentoMinutos: -5 })).toBe("resposta_atendimento_invalida");
  });

  it("rejeita alerta fora de 1-100", () => {
    expect(validarSlaConfig({ ...base, alertaPercentual: 0 })).toBe("alerta_invalido");
    expect(validarSlaConfig({ ...base, alertaPercentual: 101 })).toBe("alerta_invalido");
  });
});
