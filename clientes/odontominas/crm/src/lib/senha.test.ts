import { describe, expect, it } from "vitest";
import { compararSenhas } from "@/lib/senha";

describe("compararSenhas", () => {
  it("bate senha igual", () => {
    expect(compararSenhas("dev-admin-temp", "dev-admin-temp")).toBe(true);
  });

  it("rejeita senha diferente do mesmo tamanho", () => {
    expect(compararSenhas("dev-admin-tempX", "dev-admin-tempY")).toBe(false);
  });

  it("rejeita senha de tamanho diferente", () => {
    expect(compararSenhas("curta", "muito-mais-longa-que-a-esperada")).toBe(false);
    expect(compararSenhas("muito-mais-longa-que-a-esperada", "curta")).toBe(false);
  });

  it("rejeita quando a senha esperada não está configurada", () => {
    expect(compararSenhas("qualquer", undefined)).toBe(false);
    expect(compararSenhas("qualquer", null)).toBe(false);
    expect(compararSenhas("qualquer", "")).toBe(false);
  });

  it("string vazia contra string vazia não autentica (esperada ausente/vazia sempre falha)", () => {
    expect(compararSenhas("", "")).toBe(false);
  });
});
