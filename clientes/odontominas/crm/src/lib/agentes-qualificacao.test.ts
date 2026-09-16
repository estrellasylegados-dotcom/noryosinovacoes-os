import { describe, expect, it } from "vitest";
import { parseClassificacao } from "@/lib/agentes-qualificacao";

describe("parseClassificacao", () => {
  it("reconhece QUENTE mesmo com variação de caixa e acento", () => {
    expect(parseClassificacao("QUENTE")).toBe("quente");
    expect(parseClassificacao("quente.")).toBe("quente");
  });

  it("reconhece MORNO e FRIO", () => {
    expect(parseClassificacao("Morno")).toBe("morno");
    expect(parseClassificacao("frio")).toBe("frio");
  });

  it("aceita a palavra dentro de uma frase (a IA não respeitou o formato só-uma-palavra)", () => {
    expect(parseClassificacao("Classificação: QUENTE, paciente quer agendar")).toBe("quente");
  });

  it("volta null pra resposta que não bate com nenhuma classificação", () => {
    expect(parseClassificacao("não sei")).toBeNull();
    expect(parseClassificacao("")).toBeNull();
  });
});
