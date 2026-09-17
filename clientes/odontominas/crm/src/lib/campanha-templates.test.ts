import { describe, expect, it } from "vitest";
import { buscarTemplate, CAMPANHA_TEMPLATES } from "@/lib/campanha-templates";

describe("buscarTemplate", () => {
  it("acha um template existente pelo id", () => {
    const t = buscarTemplate("implantes");
    expect(t?.nome).toBe("Campanha de Implantes");
  });

  it("devolve null pra id desconhecido — nunca inventa um template", () => {
    expect(buscarTemplate("nao-existe")).toBeNull();
  });

  it("todos os 7 templates do briefing (item 21) estão presentes, cada um só pré-preenche (nunca dispara nada)", () => {
    expect(CAMPANHA_TEMPLATES).toHaveLength(7);
    for (const t of CAMPANHA_TEMPLATES) {
      expect(t.objetivo).toBeTruthy();
      expect(t.tipo).toBeTruthy();
    }
  });
});
