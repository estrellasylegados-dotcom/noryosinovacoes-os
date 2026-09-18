import { describe, expect, it } from "vitest";
import { validarTextoNota } from "@/lib/notas-internas";

describe("validarTextoNota", () => {
  it("aceita texto normal", () => {
    expect(validarTextoNota("Paciente pediu pra ligar depois das 18h.")).toBeNull();
  });

  it("rejeita vazio", () => {
    expect(validarTextoNota("")).toBe("texto_vazio");
  });

  it("rejeita só espaço", () => {
    expect(validarTextoNota("   ")).toBe("texto_vazio");
  });

  it("aceita exatamente 2000 caracteres", () => {
    expect(validarTextoNota("a".repeat(2000))).toBeNull();
  });

  it("rejeita acima de 2000 caracteres", () => {
    expect(validarTextoNota("a".repeat(2001))).toBe("texto_muito_longo");
  });
});
