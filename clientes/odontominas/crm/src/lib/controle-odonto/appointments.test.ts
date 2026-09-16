import { beforeEach, describe, expect, it, vi } from "vitest";

const getControleOdontoConfigMock = vi.fn();
const getControleOdontoCapabilitiesMock = vi.fn();
const getControleOdontoMock = vi.fn();

vi.mock("./config", () => ({ getControleOdontoConfig: () => getControleOdontoConfigMock() }));
vi.mock("./capabilities", () => ({ getControleOdontoCapabilities: () => getControleOdontoCapabilitiesMock() }));
vi.mock("./client", () => ({ getControleOdonto: (...args: unknown[]) => getControleOdontoMock(...args) }));

const { getAppointments } = await import("./appointments");

function capabilities(overrides: Partial<Record<string, boolean>> = {}) {
  return {
    canReadAppointments: false,
    canCreateAppointments: false,
    canUpdateAppointments: false,
    canCancelAppointments: false,
    canReadPatients: false,
    canCreatePatients: false,
    canReceiveWebhooks: false,
    ...overrides,
  };
}

describe("getAppointments", () => {
  beforeEach(() => {
    getControleOdontoConfigMock.mockReset();
    getControleOdontoCapabilitiesMock.mockReset();
    getControleOdontoMock.mockReset();
  });

  it("intervalo invertido (fim antes do início) nunca chega a checar config/capability", async () => {
    const r = await getAppointments(new Date("2026-01-10"), new Date("2026-01-01"));
    expect(r).toEqual({ ok: false, error: "intervalo_invalido" });
    expect(getControleOdontoConfigMock).not.toHaveBeenCalled();
  });

  it("data inválida também vira intervalo_invalido", async () => {
    const r = await getAppointments(new Date("data-invalida"), new Date("2026-01-01"));
    expect(r).toEqual({ ok: false, error: "intervalo_invalido" });
  });

  it("integração desligada retorna nao_configurado sem chamar a API", async () => {
    getControleOdontoConfigMock.mockReturnValue({ enabled: false, baseUrl: null, estabelecimentoId: null });
    const r = await getAppointments(new Date("2026-01-01"), new Date("2026-01-02"));
    expect(r).toEqual({ ok: false, error: "nao_configurado" });
    expect(getControleOdontoMock).not.toHaveBeenCalled();
  });

  it("sem canReadAppointments confirmada, nunca chama a API real", async () => {
    getControleOdontoConfigMock.mockReturnValue({ enabled: true, baseUrl: "https://exemplo.test", estabelecimentoId: "1" });
    getControleOdontoCapabilitiesMock.mockReturnValue(capabilities());
    const r = await getAppointments(new Date("2026-01-01"), new Date("2026-01-02"));
    expect(r).toEqual({ ok: false, error: "capability_desabilitada" });
    expect(getControleOdontoMock).not.toHaveBeenCalled();
  });

  it("mesmo com capability confirmada, exige estabelecimento configurado", async () => {
    getControleOdontoConfigMock.mockReturnValue({ enabled: true, baseUrl: "https://exemplo.test", estabelecimentoId: null });
    getControleOdontoCapabilitiesMock.mockReturnValue(capabilities({ canReadAppointments: true }));
    const r = await getAppointments(new Date("2026-01-01"), new Date("2026-01-02"));
    expect(r).toEqual({ ok: false, error: "estabelecimento_nao_configurado" });
  });

  it("payload inesperado (não é array) vira lista vazia, nunca quebra", async () => {
    getControleOdontoConfigMock.mockReturnValue({ enabled: true, baseUrl: "https://exemplo.test", estabelecimentoId: "1" });
    getControleOdontoCapabilitiesMock.mockReturnValue(capabilities({ canReadAppointments: true }));
    getControleOdontoMock.mockResolvedValue({ mensagem: "formato nunca visto antes" });

    const r = await getAppointments(new Date("2026-01-01"), new Date("2026-01-02"));
    expect(r).toEqual({ ok: true, agendamentos: [] });
  });

  it("erro na chamada HTTP vira resultado ok:false, nunca lança (client.ts já tentou retry sozinho)", async () => {
    getControleOdontoConfigMock.mockReturnValue({ enabled: true, baseUrl: "https://exemplo.test", estabelecimentoId: "1" });
    getControleOdontoCapabilitiesMock.mockReturnValue(capabilities({ canReadAppointments: true }));
    getControleOdontoMock.mockRejectedValue(new Error("http_500"));

    const r = await getAppointments(new Date("2026-01-01"), new Date("2026-01-02"));
    expect(r).toEqual({ ok: false, error: "falha_na_chamada" });
  });
});

describe("createAppointment / cancelAppointment / rescheduleAppointment", () => {
  it("todas ficam desabilitadas por capability — nenhum endpoint de escrita foi confirmado", async () => {
    const { createAppointment, cancelAppointment, rescheduleAppointment } = await import("./appointments");
    await expect(createAppointment()).resolves.toEqual({ ok: false, error: "capability_desabilitada" });
    await expect(cancelAppointment()).resolves.toEqual({ ok: false, error: "capability_desabilitada" });
    await expect(rescheduleAppointment()).resolves.toEqual({ ok: false, error: "capability_desabilitada" });
  });
});
