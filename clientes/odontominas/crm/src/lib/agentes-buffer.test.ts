import { describe, expect, it } from "vitest";
import { juntarMensagensBuffer } from "@/lib/agentes-buffer";

describe("juntarMensagensBuffer", () => {
  it("lista vazia vira string vazia", () => {
    expect(juntarMensagensBuffer([])).toBe("");
  });

  it("uma mensagem só volta sem mudança (além de trim)", () => {
    expect(juntarMensagensBuffer(["  Oi, tudo bem?  "])).toBe("Oi, tudo bem?");
  });

  it("várias mensagens da rajada juntam com quebra de linha, na ordem recebida", () => {
    expect(juntarMensagensBuffer(["Oi", "Queria marcar uma consulta", "Pra sexta de manhã"])).toBe(
      "Oi\nQueria marcar uma consulta\nPra sexta de manhã"
    );
  });

  it("ignora entradas vazias ou só espaço no meio da rajada", () => {
    expect(juntarMensagensBuffer(["Oi", "  ", "", "Tudo bem?"])).toBe("Oi\nTudo bem?");
  });

  it("lista só de strings vazias/espaço vira string vazia", () => {
    expect(juntarMensagensBuffer(["", "   ", "\n"])).toBe("");
  });
});
