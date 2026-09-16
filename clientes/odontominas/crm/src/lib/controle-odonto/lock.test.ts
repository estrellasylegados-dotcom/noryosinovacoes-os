import { beforeEach, describe, expect, it, vi } from "vitest";

const { fake } = vi.hoisted(() => {
  function criarChain(resolver: () => { data: unknown; error: { code: string } | null }) {
    type Chain = { eq: () => Chain; lt: () => Chain; then: (resolve: (v: unknown) => void) => void };
    const api: Chain = {
      eq: () => api,
      lt: () => api,
      then: (resolve: (v: unknown) => void) => resolve(resolver()),
    };
    return api;
  }

  function criarFakeSupabase() {
    let insertError: { code: string } | null = null;
    const chamadas = { insert: 0, delete: 0 };

    return {
      chamadas,
      client: {
        from: () => ({
          insert: () => {
            chamadas.insert++;
            return criarChain(() => (insertError ? { data: null, error: insertError } : { data: [{}], error: null }));
          },
          delete: () => {
            chamadas.delete++;
            return criarChain(() => ({ data: [], error: null }));
          },
        }),
      },
      forcarErroInsert: (erro: { code: string } | null) => {
        insertError = erro;
      },
    };
  }

  return { fake: criarFakeSupabase() };
});

vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => fake.client }));

const { adquirirLock, liberarLock } = await import("./lock");

describe("adquirirLock", () => {
  beforeEach(() => {
    fake.forcarErroInsert(null);
    fake.chamadas.insert = 0;
    fake.chamadas.delete = 0;
  });

  it("consegue o lock quando nada está segurando o recurso (limpa expirado + insere)", async () => {
    const r = await adquirirLock("clinica-1", "agendamento", 60_000);
    expect(r.ok).toBe(true);
    expect(r.holder).toBeTruthy();
    expect(fake.chamadas.delete).toBe(1);
    expect(fake.chamadas.insert).toBe(1);
  });

  it("lock já ocupado (23505 na chave primária composta) retorna ocupado", async () => {
    fake.forcarErroInsert({ code: "23505" });
    const r = await adquirirLock("clinica-1", "agendamento", 60_000);
    expect(r).toEqual({ ok: false, error: "ocupado" });
  });

  it("erro inesperado do banco vira lock_indisponivel, nunca lança", async () => {
    fake.forcarErroInsert({ code: "outro" });
    await expect(adquirirLock("clinica-1", "agendamento", 60_000)).resolves.toEqual({ ok: false, error: "lock_indisponivel" });
  });
});

describe("liberarLock", () => {
  it("nunca lança mesmo se o delete não encontrar nada", async () => {
    await expect(liberarLock("clinica-1", "agendamento", "holder-x")).resolves.toBeUndefined();
  });
});
