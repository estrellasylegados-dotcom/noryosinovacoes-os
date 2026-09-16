import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getControleOdontoConfig } from "./config";

const CHAVES_ENV = [
  "CONTROLE_ODONTO_ENABLED",
  "CONTROLE_ODONTO_BASE_URL",
  "CONTROLE_ODONTO_ESTABELECIMENTO_ID",
  "CONTROLE_ODONTO_SYNC_ENABLED",
  "CONTROLE_ODONTO_SYNC_INTERVAL_MINUTES",
  "CONTROLE_ODONTO_SYNC_MARGEM_HORAS",
  "CONTROLE_ODONTO_SYNC_HORIZONTE_DIAS",
] as const;

let originais: Record<string, string | undefined>;

beforeEach(() => {
  originais = Object.fromEntries(CHAVES_ENV.map((k) => [k, process.env[k]]));
  for (const k of CHAVES_ENV) delete process.env[k];
});

afterEach(() => {
  for (const k of CHAVES_ENV) {
    if (originais[k] === undefined) delete process.env[k];
    else process.env[k] = originais[k];
  }
});

describe("getControleOdontoConfig", () => {
  it("sem nenhuma env var, fica desligada com os padrões documentados", () => {
    const config = getControleOdontoConfig();
    expect(config.enabled).toBe(false);
    expect(config.baseUrl).toBeNull();
    expect(config.syncEnabled).toBe(false);
    expect(config.syncIntervalMinutes).toBe(5);
    expect(config.syncMargemHoras).toBe(24);
    expect(config.syncHorizonteDias).toBe(30);
  });

  it("CONTROLE_ODONTO_ENABLED=true sem base URL continua desligada (não tem pra onde chamar)", () => {
    process.env.CONTROLE_ODONTO_ENABLED = "true";
    expect(getControleOdontoConfig().enabled).toBe(false);
  });

  it("liga só com ENABLED=true e base URL preenchida", () => {
    process.env.CONTROLE_ODONTO_ENABLED = "true";
    process.env.CONTROLE_ODONTO_BASE_URL = "https://exemplo.test";
    expect(getControleOdontoConfig().enabled).toBe(true);
  });

  it("syncEnabled exige a integração ligada, não só a env var do sync", () => {
    process.env.CONTROLE_ODONTO_SYNC_ENABLED = "true";
    expect(getControleOdontoConfig().syncEnabled).toBe(false);
  });

  it("valores inválidos de intervalo caem no padrão em vez de virar NaN/0", () => {
    process.env.CONTROLE_ODONTO_SYNC_INTERVAL_MINUTES = "abc";
    expect(getControleOdontoConfig().syncIntervalMinutes).toBe(5);

    process.env.CONTROLE_ODONTO_SYNC_INTERVAL_MINUTES = "-10";
    expect(getControleOdontoConfig().syncIntervalMinutes).toBe(5);
  });
});
