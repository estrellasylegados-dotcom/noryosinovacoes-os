import { beforeEach, describe, expect, it } from "vitest";
import { __resetEstadoRateLimit, estaBloqueado, limparTentativas, registrarFalha } from "@/lib/rate-limit-login";

const AGORA = Date.parse("2026-01-01T00:00:00.000Z");

beforeEach(() => {
  __resetEstadoRateLimit();
});

describe("estaBloqueado / registrarFalha", () => {
  it("IP sem histórico não está bloqueado", () => {
    expect(estaBloqueado("1.2.3.4", AGORA)).toEqual({ bloqueado: false });
  });

  it("libera as primeiras 4 tentativas erradas, bloqueia na 5ª", () => {
    const ip = "1.2.3.4";
    for (let i = 0; i < 4; i++) {
      registrarFalha(ip, AGORA);
      expect(estaBloqueado(ip, AGORA).bloqueado).toBe(false);
    }
    registrarFalha(ip, AGORA);
    expect(estaBloqueado(ip, AGORA).bloqueado).toBe(true);
  });

  it("bloqueio informa segundos até liberar (janela de 15min)", () => {
    const ip = "1.2.3.4";
    for (let i = 0; i < 5; i++) registrarFalha(ip, AGORA);
    const resultado = estaBloqueado(ip, AGORA);
    expect(resultado.bloqueado).toBe(true);
    expect(resultado.retryAfterSec).toBe(15 * 60);
  });

  it("bloqueio expira depois da janela de 15min", () => {
    const ip = "1.2.3.4";
    for (let i = 0; i < 5; i++) registrarFalha(ip, AGORA);
    expect(estaBloqueado(ip, AGORA + 15 * 60 * 1000).bloqueado).toBe(false);
  });

  it("login certo (limparTentativas) reabre o IP na hora", () => {
    const ip = "1.2.3.4";
    for (let i = 0; i < 5; i++) registrarFalha(ip, AGORA);
    expect(estaBloqueado(ip, AGORA).bloqueado).toBe(true);
    limparTentativas(ip);
    expect(estaBloqueado(ip, AGORA).bloqueado).toBe(false);
  });

  it("IPs diferentes têm contadores independentes", () => {
    for (let i = 0; i < 5; i++) registrarFalha("1.1.1.1", AGORA);
    expect(estaBloqueado("1.1.1.1", AGORA).bloqueado).toBe(true);
    expect(estaBloqueado("2.2.2.2", AGORA).bloqueado).toBe(false);
  });
});
