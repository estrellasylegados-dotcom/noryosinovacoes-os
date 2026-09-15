import { describe, expect, it } from "vitest";
import { formatDataHora, formatDuracao, formatTelefone } from "@/lib/tempo";

describe("formatDuracao", () => {
  it("mostra 'agora' pra menos de 1 minuto", () => {
    expect(formatDuracao(0)).toBe("agora");
    expect(formatDuracao(59_999)).toBe("agora");
  });

  it("mostra só minutos abaixo de 1h", () => {
    expect(formatDuracao(60_000)).toBe("1min");
    expect(formatDuracao(45 * 60_000)).toBe("45min");
  });

  it("mostra horas e minutos abaixo de 1 dia", () => {
    expect(formatDuracao(60 * 60_000)).toBe("1h");
    expect(formatDuracao(90 * 60_000)).toBe("1h30min");
    expect(formatDuracao(23 * 60 * 60_000 + 59 * 60_000)).toBe("23h59min");
  });

  it("mostra dias e horas a partir de 24h", () => {
    expect(formatDuracao(24 * 60 * 60_000)).toBe("1d");
    expect(formatDuracao(25 * 60 * 60_000)).toBe("1d1h");
    expect(formatDuracao(3 * 24 * 60 * 60_000 + 5 * 60 * 60_000)).toBe("3d5h");
  });

  it("nunca fica negativo (relógio do servidor ligeiramente adiantado)", () => {
    expect(formatDuracao(-5000)).toBe("agora");
  });
});

describe("formatDataHora", () => {
  it("devolve travessão pra nulo", () => {
    expect(formatDataHora(null)).toBe("—");
  });

  it("formata em pt-BR (dia/mês hora:min)", () => {
    const iso = "2026-03-05T14:30:00.000Z";
    const resultado = formatDataHora(iso);
    // Fuso varia por ambiente de teste; garante formato, não o valor exato da hora.
    expect(resultado).toMatch(/^\d{2}\/\d{2}, \d{2}:\d{2}$/);
  });
});

describe("formatTelefone", () => {
  it("formata celular BR (11 dígitos) sem DDI", () => {
    expect(formatTelefone("62999998888")).toBe("(62) 99999-8888");
  });

  it("formata fixo BR (10 dígitos) sem DDI", () => {
    expect(formatTelefone("6233334444")).toBe("(62) 3333-4444");
  });

  it("remove o DDI 55 antes de formatar", () => {
    expect(formatTelefone("5562999998888")).toBe("(62) 99999-8888");
  });

  it("cai no valor cru quando não bate um formato BR conhecido", () => {
    expect(formatTelefone("123")).toBe("123");
  });
});
