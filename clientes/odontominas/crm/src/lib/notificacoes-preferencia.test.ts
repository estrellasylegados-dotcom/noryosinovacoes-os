import { describe, expect, it } from "vitest";
import { deveNotificar } from "@/lib/notificacoes-preferencia";

describe("deveNotificar", () => {
  it("desligado nunca notifica, nenhum tipo", () => {
    expect(deveNotificar("nao_lida", "desligado")).toBe(false);
    expect(deveNotificar("esfriando", "desligado")).toBe(false);
  });

  it("tudo notifica os dois tipos", () => {
    expect(deveNotificar("nao_lida", "tudo")).toBe(true);
    expect(deveNotificar("esfriando", "tudo")).toBe(true);
  });

  it("so_esfriando notifica só lead esfriando, não mensagem não lida", () => {
    expect(deveNotificar("esfriando", "so_esfriando")).toBe(true);
    expect(deveNotificar("nao_lida", "so_esfriando")).toBe(false);
  });
});
