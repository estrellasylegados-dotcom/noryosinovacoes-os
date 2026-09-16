import { describe, expect, it } from "vitest";
import { resolverVariaveis } from "@/lib/mensagens-salvas";

describe("resolverVariaveis", () => {
  it("substitui {nome}, {primeiro_nome} e {telefone}", () => {
    const texto = resolverVariaveis("Oi {primeiro_nome}! Seu telefone é {telefone}, certo {nome}?", {
      nome: "Maria Silva Souza",
      telefone: "5561999999999",
    });
    expect(texto).toBe("Oi Maria! Seu telefone é 5561999999999, certo Maria Silva Souza?");
  });

  it("nunca produz 'undefined' quando o nome não existe", () => {
    const texto = resolverVariaveis("Olá {nome}, tudo bem?", { nome: null, telefone: null });
    expect(texto.toLowerCase()).not.toContain("undefined");
  });

  it("sem nome, limpa a pontuação órfã em vez de deixar espaço/vírgula soltos", () => {
    expect(resolverVariaveis("Oi {primeiro_nome}, tudo bem?", { nome: null })).toBe("Oi, tudo bem?");
    expect(resolverVariaveis("Oi, {nome}!", { nome: null })).toBe("Oi!");
  });

  it("nome em branco é tratado como ausente", () => {
    expect(resolverVariaveis("Oi {nome}!", { nome: "   " })).toBe("Oi!");
  });

  it("telefone ausente vira string vazia, não 'null'/'undefined'", () => {
    const texto = resolverVariaveis("Confirma o número {telefone}?", { nome: "Ana" });
    expect(texto.toLowerCase()).not.toContain("null");
    expect(texto.toLowerCase()).not.toContain("undefined");
  });
});
