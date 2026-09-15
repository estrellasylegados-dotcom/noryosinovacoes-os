import { describe, expect, it } from "vitest";
import { HASH_DUMMY_TIMING, compararSenhas, hashSenha, verificarSenha } from "@/lib/senha";

describe("compararSenhas", () => {
  it("bate segredo igual", () => {
    expect(compararSenhas("cron-secret-123", "cron-secret-123")).toBe(true);
  });

  it("rejeita segredo diferente do mesmo tamanho", () => {
    expect(compararSenhas("cron-secret-123X", "cron-secret-123Y")).toBe(false);
  });

  it("rejeita segredo de tamanho diferente", () => {
    expect(compararSenhas("curta", "muito-mais-longa-que-a-esperada")).toBe(false);
    expect(compararSenhas("muito-mais-longa-que-a-esperada", "curta")).toBe(false);
  });

  it("rejeita quando o segredo esperado não está configurado", () => {
    expect(compararSenhas("qualquer", undefined)).toBe(false);
    expect(compararSenhas("qualquer", null)).toBe(false);
    expect(compararSenhas("qualquer", "")).toBe(false);
  });

  it("string vazia contra string vazia não autentica (esperada ausente/vazia sempre falha)", () => {
    expect(compararSenhas("", "")).toBe(false);
  });
});

describe("hashSenha / verificarSenha", () => {
  it("senha certa bate contra o próprio hash", () => {
    const hash = hashSenha("minha-senha-123");
    expect(verificarSenha("minha-senha-123", hash)).toBe(true);
  });

  it("senha errada não bate", () => {
    const hash = hashSenha("minha-senha-123");
    expect(verificarSenha("outra-senha", hash)).toBe(false);
  });

  it("dois hashes da mesma senha são diferentes (salt aleatório) e os dois continuam válidos", () => {
    const a = hashSenha("repetida");
    const b = hashSenha("repetida");
    expect(a).not.toBe(b);
    expect(verificarSenha("repetida", a)).toBe(true);
    expect(verificarSenha("repetida", b)).toBe(true);
  });

  it("hash ausente ou malformado nunca autentica", () => {
    expect(verificarSenha("qualquer", undefined)).toBe(false);
    expect(verificarSenha("qualquer", null)).toBe(false);
    expect(verificarSenha("qualquer", "")).toBe(false);
    expect(verificarSenha("qualquer", "sem-separador")).toBe(false);
  });

  it("HASH_DUMMY_TIMING nunca bate com senha nenhuma (é só pra gastar tempo de CPU, não autentica ninguém)", () => {
    expect(verificarSenha("qualquer-coisa", HASH_DUMMY_TIMING)).toBe(false);
    expect(verificarSenha("", HASH_DUMMY_TIMING)).toBe(false);
  });
});
