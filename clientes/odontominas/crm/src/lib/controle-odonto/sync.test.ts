import { beforeEach, describe, expect, it, vi } from "vitest";

const getControleOdontoConfigMock = vi.fn();
const getControleOdontoCapabilitiesMock = vi.fn();
const adquirirLockMock = vi.fn();
const liberarLockMock = vi.fn();
const getSyncStateMock = vi.fn();
const registrarSucessoSyncMock = vi.fn();
const registrarFalhaSyncMock = vi.fn();
const registrarLogMock = vi.fn();
const getAppointmentsMock = vi.fn();
const upsertExternalIdMock = vi.fn();

vi.mock("./config", () => ({ getControleOdontoConfig: () => getControleOdontoConfigMock() }));
vi.mock("./capabilities", () => ({ getControleOdontoCapabilities: () => getControleOdontoCapabilitiesMock() }));
vi.mock("./lock", () => ({
  adquirirLock: (...a: unknown[]) => adquirirLockMock(...a),
  liberarLock: (...a: unknown[]) => liberarLockMock(...a),
}));
vi.mock("./sync-state", () => ({
  getSyncState: (...a: unknown[]) => getSyncStateMock(...a),
  registrarSucessoSync: (...a: unknown[]) => registrarSucessoSyncMock(...a),
  registrarFalhaSync: (...a: unknown[]) => registrarFalhaSyncMock(...a),
}));
vi.mock("./sync-log", () => ({ registrarLog: (...a: unknown[]) => registrarLogMock(...a) }));
vi.mock("./appointments", () => ({ getAppointments: (...a: unknown[]) => getAppointmentsMock(...a) }));
vi.mock("./external-ids", () => ({ upsertExternalId: (...a: unknown[]) => upsertExternalIdMock(...a) }));

const { runAppointmentsSync, calcularJanelaSync } = await import("./sync");

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

describe("calcularJanelaSync", () => {
  it("sem sucesso anterior, usa só a margem pra trás a partir de agora", () => {
    const agora = new Date("2026-09-16T12:00:00Z");
    const janela = calcularJanelaSync(agora, null, 24, 30);
    expect(janela.inicio.toISOString()).toBe("2026-09-15T12:00:00.000Z");
    expect(janela.fim.toISOString()).toBe("2026-10-16T12:00:00.000Z");
  });

  it("com sucesso anterior mais antigo que a margem simples, começa a partir dele (não perde alteração atrasada)", () => {
    const agora = new Date("2026-09-16T12:00:00Z");
    const ultimoSucesso = new Date("2026-09-10T00:00:00Z");
    const janela = calcularJanelaSync(agora, ultimoSucesso, 24, 30);
    expect(janela.inicio.toISOString()).toBe("2026-09-09T00:00:00.000Z");
  });
});

describe("runAppointmentsSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("integração desligada nunca chega a tentar lock nem chamada nenhuma", async () => {
    getControleOdontoConfigMock.mockReturnValue({ enabled: false });

    const r = await runAppointmentsSync("clinica-1");
    expect(r).toEqual({ ok: false, status: "nao_configurado", error: "integracao_desligada" });
    expect(adquirirLockMock).not.toHaveBeenCalled();
  });

  it("sem canReadAppointments confirmada, registra log ignorado e nunca chama getAppointments", async () => {
    getControleOdontoConfigMock.mockReturnValue({ enabled: true, syncMargemHoras: 24, syncHorizonteDias: 30 });
    getControleOdontoCapabilitiesMock.mockReturnValue(capabilities());

    const r = await runAppointmentsSync("clinica-1");
    expect(r).toEqual({ ok: false, status: "aguardando_credencial", error: "capability_canReadAppointments_desabilitada" });
    expect(registrarLogMock).toHaveBeenCalledWith(expect.objectContaining({ status: "ignorado" }));
    expect(getAppointmentsMock).not.toHaveBeenCalled();
    expect(adquirirLockMock).not.toHaveBeenCalled();
  });

  it("sync concorrente: lock já ocupado retorna status ocupado sem chamar getAppointments", async () => {
    getControleOdontoConfigMock.mockReturnValue({ enabled: true, syncMargemHoras: 24, syncHorizonteDias: 30 });
    getControleOdontoCapabilitiesMock.mockReturnValue(capabilities({ canReadAppointments: true }));
    adquirirLockMock.mockResolvedValue({ ok: false, error: "ocupado" });

    const r = await runAppointmentsSync("clinica-1");
    expect(r).toEqual({ ok: false, status: "ocupado", error: "ocupado" });
    expect(getAppointmentsMock).not.toHaveBeenCalled();
  });

  it("sucesso: adquire lock, sincroniza, faz upsert idempotente (1x por agendamento) e sempre libera o lock", async () => {
    getControleOdontoConfigMock.mockReturnValue({ enabled: true, syncMargemHoras: 24, syncHorizonteDias: 30 });
    getControleOdontoCapabilitiesMock.mockReturnValue(capabilities({ canReadAppointments: true }));
    adquirirLockMock.mockResolvedValue({ ok: true, holder: "holder-1" });
    getSyncStateMock.mockResolvedValue(null);
    getAppointmentsMock.mockResolvedValue({
      ok: true,
      agendamentos: [
        {
          externalId: "a1",
          establishmentExternalId: null,
          professionalExternalId: null,
          patientExternalId: null,
          patientPhone: null,
          startAt: null,
          endAt: null,
          status: "unknown_external_status",
          rawStatus: "x",
        },
      ],
    });

    const r = await runAppointmentsSync("clinica-1");
    expect(r.ok).toBe(true);
    expect(upsertExternalIdMock).toHaveBeenCalledTimes(1);
    expect(registrarSucessoSyncMock).toHaveBeenCalledTimes(1);
    expect(liberarLockMock).toHaveBeenCalledWith("clinica-1", "agendamento", "holder-1");
  });

  it("o mesmo agendamento voltando 2x numa mesma rodada faz upsert 2x, nunca duplica linha (chave é o external_id)", async () => {
    getControleOdontoConfigMock.mockReturnValue({ enabled: true, syncMargemHoras: 24, syncHorizonteDias: 30 });
    getControleOdontoCapabilitiesMock.mockReturnValue(capabilities({ canReadAppointments: true }));
    adquirirLockMock.mockResolvedValue({ ok: true, holder: "holder-1" });
    getSyncStateMock.mockResolvedValue(null);
    const agendamentoDuplicado = {
      externalId: "a1",
      establishmentExternalId: null,
      professionalExternalId: null,
      patientExternalId: null,
      patientPhone: null,
      startAt: null,
      endAt: null,
      status: "unknown_external_status" as const,
      rawStatus: "x",
    };
    getAppointmentsMock.mockResolvedValue({ ok: true, agendamentos: [agendamentoDuplicado, agendamentoDuplicado] });

    await runAppointmentsSync("clinica-1");
    expect(upsertExternalIdMock).toHaveBeenCalledTimes(2);
    expect(upsertExternalIdMock).toHaveBeenNthCalledWith(1, "clinica-1", "consulta", "a1", expect.any(Object));
    expect(upsertExternalIdMock).toHaveBeenNthCalledWith(2, "clinica-1", "consulta", "a1", expect.any(Object));
  });

  it("erro na leitura: registra falha, libera o lock mesmo assim, e não faz upsert nenhum", async () => {
    getControleOdontoConfigMock.mockReturnValue({ enabled: true, syncMargemHoras: 24, syncHorizonteDias: 30 });
    getControleOdontoCapabilitiesMock.mockReturnValue(capabilities({ canReadAppointments: true }));
    adquirirLockMock.mockResolvedValue({ ok: true, holder: "holder-1" });
    getSyncStateMock.mockResolvedValue(null);
    getAppointmentsMock.mockResolvedValue({ ok: false, error: "http_500" });

    const r = await runAppointmentsSync("clinica-1");
    expect(r).toEqual({ ok: false, status: "erro", error: "http_500" });
    expect(registrarFalhaSyncMock).toHaveBeenCalledWith("clinica-1", "agendamento", "http_500");
    expect(upsertExternalIdMock).not.toHaveBeenCalled();
    expect(liberarLockMock).toHaveBeenCalledWith("clinica-1", "agendamento", "holder-1");
  });
});
