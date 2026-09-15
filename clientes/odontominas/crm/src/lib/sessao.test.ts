import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarTokenSessao, lerSessao } from "@/lib/sessao";

const SECRET_ORIGINAL = process.env.SESSAO_SECRET;

beforeEach(() => {
  process.env.SESSAO_SECRET = "segredo-de-teste-bem-longo-e-aleatorio";
});

afterEach(() => {
  process.env.SESSAO_SECRET = SECRET_ORIGINAL;
  vi.useRealTimers();
});

describe("criarTokenSessao / lerSessao", () => {
  it("token recém-criado é lido de volta com id, nome e papel certos", async () => {
    const token = await criarTokenSessao("atd-1", "Ana", "admin");
    const sessao = await lerSessao(token);
    expect(sessao).toEqual({ atendenteId: "atd-1", nome: "Ana", papel: "admin" });
  });

  it("papel 'atendente' também funciona", async () => {
    const token = await criarTokenSessao("atd-2", "Bruna", "atendente");
    const sessao = await lerSessao(token);
    expect(sessao).toEqual({ atendenteId: "atd-2", nome: "Bruna", papel: "atendente" });
  });

  it("nome com acento e caracteres especiais sobrevive à ida e volta (UTF-8 via base64url)", async () => {
    const token = await criarTokenSessao("atd-3", "José Ariadna Ção", "atendente");
    const sessao = await lerSessao(token);
    expect(sessao?.nome).toBe("José Ariadna Ção");
  });

  it("token vazio/ausente devolve null", async () => {
    expect(await lerSessao(undefined)).toBeNull();
    expect(await lerSessao(null)).toBeNull();
    expect(await lerSessao("")).toBeNull();
  });

  it("token sem ponto separador (sem assinatura) devolve null", async () => {
    expect(await lerSessao("admin:atd-1:bm9tZQ:123456")).toBeNull();
  });

  it("payload com menos campos que o esperado devolve null mesmo com formato de assinatura certo", async () => {
    const token = await criarTokenSessao("atd-1", "Ana", "admin");
    const assinatura = token.slice(token.lastIndexOf("."));
    expect(await lerSessao(`admin:atd-1${assinatura}`)).toBeNull();
  });

  it("papel fora da lista permitida devolve null mesmo com formato certo", async () => {
    const token = await criarTokenSessao("atd-1", "Ana", "admin");
    const assinatura = token.slice(token.lastIndexOf("."));
    expect(await lerSessao(`superadmin:atd-1:bm9tZQ:9999999999999${assinatura}`)).toBeNull();
  });

  it("assinatura adulterada (papel trocado no payload) é rejeitada — é isto que impede um atendente de virar admin editando o cookie", async () => {
    const token = await criarTokenSessao("atd-2", "Bruna", "atendente");
    const assinatura = token.slice(token.lastIndexOf("."));
    const tokenForjado = `admin:atd-2:QnJ1bmE${assinatura}`;
    expect(await lerSessao(tokenForjado)).toBeNull();
  });

  it("assinado com outro segredo é rejeitado (ex.: SESSAO_SECRET trocado entre deploys)", async () => {
    const token = await criarTokenSessao("atd-1", "Ana", "admin");
    process.env.SESSAO_SECRET = "outro-segredo-completamente-diferente";
    expect(await lerSessao(token)).toBeNull();
  });

  it("token expirado é rejeitado", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = await criarTokenSessao("atd-1", "Ana", "admin");

    vi.setSystemTime(new Date("2026-01-01T13:00:00.000Z")); // 13h depois, sessão dura 12h
    expect(await lerSessao(token)).toBeNull();
  });

  it("token ainda dentro da janela de 12h continua válido", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = await criarTokenSessao("atd-1", "Ana", "admin");

    vi.setSystemTime(new Date("2026-01-01T11:59:00.000Z"));
    expect(await lerSessao(token)).toEqual({ atendenteId: "atd-1", nome: "Ana", papel: "admin" });
  });
});
