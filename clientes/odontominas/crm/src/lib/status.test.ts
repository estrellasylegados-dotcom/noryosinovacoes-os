import { describe, expect, it } from "vitest";
import { isStatusValido, STATUS_ORDEM, STATUS_RESOLVIDOS } from "@/lib/status";

describe("isStatusValido", () => {
  it("aceita todo valor de STATUS_ORDEM", () => {
    for (const status of STATUS_ORDEM) {
      expect(isStatusValido(status)).toBe(true);
    }
  });

  it("rejeita string arbitrária", () => {
    expect(isStatusValido("cancelado")).toBe(false);
    expect(isStatusValido("")).toBe(false);
  });
});

describe("STATUS_RESOLVIDOS", () => {
  it("é exatamente respondido/agendado/perdido — não inclui novo nem aguardando", () => {
    expect(STATUS_RESOLVIDOS.sort()).toEqual(["agendado", "perdido", "respondido"].sort());
  });
});
