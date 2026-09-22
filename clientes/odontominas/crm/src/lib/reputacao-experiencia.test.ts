import { describe, expect, it } from "vitest";
import { classificarRespostaExperiencia } from "@/lib/reputacao-experiencia";

describe("classificarRespostaExperiencia", () => {
  it("classifica opções e resposta livre sem depender de nota", () => {
    expect(classificarRespostaExperiencia("😊 Muito boa")).toBe("muito_boa");
    expect(classificarRespostaExperiencia("Gostei muito, fui muito bem atendido.")).toBe("muito_boa");
    expect(classificarRespostaExperiencia("Foi boa, tudo certo.")).toBe("boa");
    expect(classificarRespostaExperiencia("Demorou bastante e não gostei.")).toBe("poderia_melhorar");
  });
  it("não inventa classificação para resposta ambígua", () => {
    expect(classificarRespostaExperiencia("Foi mais ou menos.")).toBe("ambiguo");
  });
});
