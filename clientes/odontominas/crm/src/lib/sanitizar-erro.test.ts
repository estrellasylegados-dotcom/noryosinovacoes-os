import { describe, expect, it, vi } from "vitest";
import { sanitizarMensagemErro } from "@/lib/sanitizar-erro";

describe("sanitizarMensagemErro", () => {
  it("redige chave do Resend, Bearer, hex longo e credencial em URL", () => {
    const t = sanitizarMensagemErro("falhou re_AbCdEf123456789 Bearer abc.def token=xyz123 postgres://user:pass@host/db " + "a".repeat(40));
    expect(t).not.toMatch(/re_AbCdEf/);
    expect(t).not.toMatch(/abc\.def/);
    expect(t).not.toMatch(/xyz123/);
    expect(t).not.toMatch(/user:pass/);
    expect(t).not.toMatch(/a{40}/);
  });
  it("redige o valor literal de variável sensível e trunca", () => {
    vi.stubEnv("RESEND_API_KEY", "valor-secreto-qualquer-1234");
    expect(sanitizarMensagemErro("erro com valor-secreto-qualquer-1234 no meio")).toBe("erro com [redigido] no meio");
    expect(sanitizarMensagemErro("x".repeat(500)).length).toBeLessThanOrEqual(301);
    vi.unstubAllEnvs();
  });
  it("mantém mensagem comum legível", () => {
    expect(sanitizarMensagemErro("You can only send testing emails to your own email address")).toContain("only send testing emails");
  });
});
