import { afterEach, describe, expect, it, vi } from "vitest";
import { calcularExpiracaoToken, gerarTrackingToken, montarUrlRastreavel, tokenExpirado } from "@/lib/reputacao-tracking";

describe("gerarTrackingToken", () => {
  it("gera token opaco, sem estrutura decodificável, sempre diferente", () => {
    const a = gerarTrackingToken();
    const b = gerarTrackingToken();

    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(30); // 256 bits em base64url
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // base64url: nunca vaza '/'/'+' que quebrariam a URL
  });
});

describe("calcularExpiracaoToken", () => {
  it("expira 90 dias depois do momento informado", () => {
    const agora = new Date("2026-01-01T00:00:00.000Z");
    const expira = calcularExpiracaoToken(agora);

    expect(expira).toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("tokenExpirado", () => {
  it("sem data de expiração, nunca expira", () => {
    expect(tokenExpirado({ tokenExpiraEm: null } as never)).toBe(false);
  });

  it("data no passado: expirado", () => {
    const lookup = { tokenExpiraEm: "2026-01-01T00:00:00.000Z" } as never;
    expect(tokenExpirado(lookup, new Date("2026-02-01T00:00:00.000Z"))).toBe(true);
  });

  it("data no futuro: ainda válido", () => {
    const lookup = { tokenExpiraEm: "2026-06-01T00:00:00.000Z" } as never;
    expect(tokenExpirado(lookup, new Date("2026-02-01T00:00:00.000Z"))).toBe(false);
  });
});

describe("montarUrlRastreavel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sem APP_URL configurada, não monta link (chamador cai pro link direto do Google)", () => {
    vi.stubEnv("APP_URL", "");
    expect(montarUrlRastreavel("token-abc")).toBeNull();
  });

  it("monta a URL pública de redirect a partir do token", () => {
    vi.stubEnv("APP_URL", "https://painel.odontominas.com.br");
    expect(montarUrlRastreavel("token-abc")).toBe("https://painel.odontominas.com.br/api/r/review/token-abc");
  });

  it("remove barra final da base pra não duplicar barra na URL montada", () => {
    vi.stubEnv("APP_URL", "https://painel.odontominas.com.br/");
    expect(montarUrlRastreavel("token-abc")).toBe("https://painel.odontominas.com.br/api/r/review/token-abc");
  });
});
