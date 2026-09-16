import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getControleOdonto } from "./client";
import { ControleOdontoHttpError, ControleOdontoTimeoutError } from "./errors";
import type { ControleOdontoAuthProvider } from "./auth";
import type { ControleOdontoConfig } from "./config";

const config: ControleOdontoConfig = {
  enabled: true,
  baseUrl: "https://exemplo.test",
  estabelecimentoId: "1",
  syncEnabled: false,
  syncIntervalMinutes: 5,
  syncMargemHoras: 24,
  syncHorizonteDias: 30,
};

const authFake: ControleOdontoAuthProvider = {
  aplicarAutenticacao: (init) => init,
};

describe("getControleOdonto", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retorna o JSON quando a resposta é 200 de primeira, sem retry nenhum", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ dado: 1 }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getControleOdonto("/v6/teste", { timeoutMs: 50 }, config, authFake)).resolves.toEqual({ dado: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tenta de novo em 503 (retentável) e depois tem sucesso", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ dado: 2 }) });
    vi.stubGlobal("fetch", fetchMock);

    const promessa = getControleOdonto("/v6/teste", { timeoutMs: 50, maxTentativas: 3 }, config, authFake);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promessa).resolves.toEqual({ dado: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("tenta de novo em 429 (rate limit)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ dado: 3 }) });
    vi.stubGlobal("fetch", fetchMock);

    const promessa = getControleOdonto("/v6/teste", { timeoutMs: 50, maxTentativas: 3 }, config, authFake);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promessa).resolves.toEqual({ dado: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("nunca repete 401 — falha na 1ª tentativa", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getControleOdonto("/v6/teste", { timeoutMs: 50, maxTentativas: 3 }, config, authFake)).rejects.toBeInstanceOf(
      ControleOdontoHttpError
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("nunca repete 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getControleOdonto("/v6/teste", { timeoutMs: 50, maxTentativas: 3 }, config, authFake)).rejects.toBeInstanceOf(
      ControleOdontoHttpError
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("esgota as tentativas em 500 repetido e lança ControleOdontoHttpError", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    const promessa = getControleOdonto("/v6/teste", { timeoutMs: 50, maxTentativas: 3 }, config, authFake);
    const expectativa = expect(promessa).rejects.toBeInstanceOf(ControleOdontoHttpError);
    await vi.advanceTimersByTimeAsync(15_000);
    await expectativa;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("timeout (AbortError) tenta de novo e por fim vira ControleOdontoTimeoutError", async () => {
    const erroAbort = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    const fetchMock = vi.fn().mockRejectedValue(erroAbort);
    vi.stubGlobal("fetch", fetchMock);

    const promessa = getControleOdonto("/v6/teste", { timeoutMs: 50, maxTentativas: 2 }, config, authFake);
    const expectativa = expect(promessa).rejects.toBeInstanceOf(ControleOdontoTimeoutError);
    await vi.advanceTimersByTimeAsync(10_000);
    await expectativa;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sem base URL configurada, lança antes de tentar qualquer fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getControleOdonto("/v6/teste", {}, { ...config, baseUrl: null }, authFake)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
