import { describe, expect, it } from "vitest";
import { normalizarNomePessoa } from "@/lib/nome-pessoa";

describe("normalizarNomePessoa", () => {
  it("preserva um nome válido, sem espaços acidentais", () => {
    expect(normalizarNomePessoa("  Maria Silva  ")).toBe("Maria Silva");
  });

  it("não expõe identificador numérico como nome", () => {
    expect(normalizarNomePessoa("165489602998310")).toBeNull();
  });

  it("trata ausência de nome como ausência", () => {
    expect(normalizarNomePessoa("   ")).toBeNull();
  });
});
