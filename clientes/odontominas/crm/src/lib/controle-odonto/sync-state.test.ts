import { describe, expect, it } from "vitest";
import { calcularHealth } from "./sync-state";

describe("calcularHealth", () => {
  it("desligada é sempre nao_configurada, mesmo com sucesso registrado antes", () => {
    expect(calcularHealth({ enabled: false, consecutiveFailures: 0, lastSuccessAt: new Date().toISOString() })).toBe("nao_configurada");
  });

  it("ligada, nunca teve sucesso e nenhuma falha ainda: nao_configurada (nunca rodou de verdade)", () => {
    expect(calcularHealth({ enabled: true, consecutiveFailures: 0, lastSuccessAt: null })).toBe("nao_configurada");
  });

  it("com sucesso e zero falhas seguidas: saudavel", () => {
    expect(calcularHealth({ enabled: true, consecutiveFailures: 0, lastSuccessAt: new Date().toISOString() })).toBe("saudavel");
  });

  it("1 ou 2 falhas seguidas: degradada", () => {
    expect(calcularHealth({ enabled: true, consecutiveFailures: 1, lastSuccessAt: null })).toBe("degradada");
    expect(calcularHealth({ enabled: true, consecutiveFailures: 2, lastSuccessAt: null })).toBe("degradada");
  });

  it("3 ou mais falhas seguidas: indisponivel (circuit breaker)", () => {
    expect(calcularHealth({ enabled: true, consecutiveFailures: 3, lastSuccessAt: null })).toBe("indisponivel");
    expect(calcularHealth({ enabled: true, consecutiveFailures: 10, lastSuccessAt: null })).toBe("indisponivel");
  });
});
