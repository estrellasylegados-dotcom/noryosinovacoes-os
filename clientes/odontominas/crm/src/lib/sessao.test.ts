import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarTokenSessao, lerTokenSessao } from "@/lib/sessao";

const SECRET_ORIGINAL = process.env.SESSAO_SECRET;

beforeEach(() => {
  process.env.SESSAO_SECRET = "segredo-de-teste-bem-longo-e-aleatorio";
});

afterEach(() => {
  process.env.SESSAO_SECRET = SECRET_ORIGINAL;
  vi.useRealTimers();
});

describe("criarTokenSessao / lerTokenSessao", () => {
  it("token recém-criado é lido de volta com id e versão de sessão certos", async () => {
    const token = await criarTokenSessao("atd-1", 0);
    const sessao = await lerTokenSessao(token);
    expect(sessao?.atendenteId).toBe("atd-1");
    expect(sessao?.sessaoVersao).toBe(0);
  });

  it("versão de sessão diferente de 0 também funciona (conta já teve sessão revogada antes)", async () => {
    const token = await criarTokenSessao("atd-2", 3);
    const sessao = await lerTokenSessao(token);
    expect(sessao?.sessaoVersao).toBe(3);
  });

  it("token vazio/ausente devolve null", async () => {
    expect(await lerTokenSessao(undefined)).toBeNull();
    expect(await lerTokenSessao(null)).toBeNull();
    expect(await lerTokenSessao("")).toBeNull();
  });

  it("token sem ponto separador (sem assinatura) devolve null", async () => {
    expect(await lerTokenSessao("atd-1:0:123456")).toBeNull();
  });

  it("payload com menos campos que o esperado devolve null mesmo com formato de assinatura certo", async () => {
    const token = await criarTokenSessao("atd-1", 0);
    const assinatura = token.slice(token.lastIndexOf("."));
    expect(await lerTokenSessao(`atd-1:0${assinatura}`)).toBeNull();
  });

  it("versão de sessão não numérica devolve null mesmo com formato certo", async () => {
    const token = await criarTokenSessao("atd-1", 0);
    const assinatura = token.slice(token.lastIndexOf("."));
    expect(await lerTokenSessao(`atd-1:nao-numero:9999999999999${assinatura}`)).toBeNull();
  });

  it("assinatura adulterada (versão de sessão trocada no payload) é rejeitada — é isto que impede reusar um token já revogado", async () => {
    const token = await criarTokenSessao("atd-2", 0);
    const assinatura = token.slice(token.lastIndexOf("."));
    const tokenForjado = `atd-2:1:${token.split(":")[2]}${assinatura}`;
    expect(await lerTokenSessao(tokenForjado)).toBeNull();
  });

  it("assinado com outro segredo é rejeitado (ex.: SESSAO_SECRET trocado entre deploys)", async () => {
    const token = await criarTokenSessao("atd-1", 0);
    process.env.SESSAO_SECRET = "outro-segredo-completamente-diferente";
    expect(await lerTokenSessao(token)).toBeNull();
  });

  it("token expirado é rejeitado", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = await criarTokenSessao("atd-1", 0);

    vi.setSystemTime(new Date("2026-01-01T13:00:00.000Z")); // 13h depois, sessão dura 12h
    expect(await lerTokenSessao(token)).toBeNull();
  });

  it("token ainda dentro da janela de 12h continua válido", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = await criarTokenSessao("atd-1", 0);

    vi.setSystemTime(new Date("2026-01-01T11:59:00.000Z"));
    const sessao = await lerTokenSessao(token);
    expect(sessao?.atendenteId).toBe("atd-1");
  });
});
