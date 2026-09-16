import { describe, expect, it } from "vitest";
import { getControleOdontoCapabilities } from "./capabilities";
import type { ControleOdontoConfig } from "./config";

function config(overrides: Partial<ControleOdontoConfig> = {}): ControleOdontoConfig {
  return {
    enabled: false,
    baseUrl: null,
    estabelecimentoId: null,
    syncEnabled: false,
    syncIntervalMinutes: 5,
    syncMargemHoras: 24,
    syncHorizonteDias: 30,
    ...overrides,
  };
}

describe("getControleOdontoCapabilities", () => {
  it("integração desligada nunca tem capability nenhuma ligada", () => {
    const capabilities = getControleOdontoCapabilities(config({ enabled: false }));
    expect(Object.values(capabilities).every((v) => v === false)).toBe(true);
  });

  it("mesmo com a integração ligada, nenhuma capability confirmada ainda (auth/endpoint pendentes)", () => {
    const capabilities = getControleOdontoCapabilities(config({ enabled: true, baseUrl: "https://exemplo.test" }));
    expect(capabilities.canReadAppointments).toBe(false);
    expect(capabilities.canCreateAppointments).toBe(false);
    expect(capabilities.canUpdateAppointments).toBe(false);
    expect(capabilities.canCancelAppointments).toBe(false);
    expect(capabilities.canReadPatients).toBe(false);
    expect(capabilities.canCreatePatients).toBe(false);
    expect(capabilities.canReceiveWebhooks).toBe(false);
  });
});
