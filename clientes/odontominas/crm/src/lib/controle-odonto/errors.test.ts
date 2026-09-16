import { describe, expect, it } from "vitest";
import { ehStatusRetentavel, erroHttp, ControleOdontoHttpError } from "./errors";

describe("ehStatusRetentavel", () => {
  it("429/500/502/503/504 valem retry", () => {
    for (const status of [429, 500, 502, 503, 504]) {
      expect(ehStatusRetentavel(status)).toBe(true);
    }
  });

  it("400/401/403/404 nunca valem retry", () => {
    for (const status of [400, 401, 403, 404]) {
      expect(ehStatusRetentavel(status)).toBe(false);
    }
  });
});

describe("ControleOdontoHttpError", () => {
  it("guarda o status e usa erroHttp como mensagem padrão", () => {
    const erro = new ControleOdontoHttpError(503);
    expect(erro.status).toBe(503);
    expect(erro.message).toBe(erroHttp(503));
    expect(erro.message).toBe("http_503");
  });
});
