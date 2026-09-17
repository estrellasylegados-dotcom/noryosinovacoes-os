import { describe, expect, it } from "vitest";
import { isStatusCampanhaValido, labelCanal, labelObjetivo, labelTipoCampanha, STATUS_CAMPANHA_ORDEM } from "@/lib/campanhas";

describe("isStatusCampanhaValido", () => {
  it("aceita os 6 status do conjunto fechado (item 19 do briefing)", () => {
    for (const status of STATUS_CAMPANHA_ORDEM) {
      expect(isStatusCampanhaValido(status)).toBe(true);
    }
  });

  it("rejeita string fora do conjunto (ex.: valor em inglês do briefing original, nunca usado no banco)", () => {
    expect(isStatusCampanhaValido("active")).toBe(false);
    expect(isStatusCampanhaValido("")).toBe(false);
    expect(isStatusCampanhaValido("qualquer-coisa")).toBe(false);
  });
});

describe("catálogos de rótulo (objetivo/tipo/canal)", () => {
  it("acham o rótulo certo pra um valor conhecido", () => {
    expect(labelObjetivo("gerar_agendamentos")).toBe("Gerar agendamentos");
    expect(labelTipoCampanha("implantes")).toBe("Implantes");
    expect(labelCanal("whatsapp")).toBe("WhatsApp");
  });

  it("cai no próprio valor cru quando a opção é nova (item 3: permitir expansão futura sem migração)", () => {
    expect(labelObjetivo("campanha_de_natal")).toBe("campanha_de_natal");
    expect(labelTipoCampanha("bichectomia")).toBe("bichectomia");
    expect(labelCanal("tiktok_ads")).toBe("tiktok_ads");
  });
});
