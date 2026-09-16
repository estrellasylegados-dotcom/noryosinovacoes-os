import { beforeEach, describe, expect, it, vi } from "vitest";

const { fake } = vi.hoisted(() => {
  function criarFakeSupabase() {
    let ultimoUpsert: { payload: unknown; onConflict: string } | null = null;
    let erroForcado: { code: string } | null = null;

    return {
      client: {
        from: () => ({
          upsert(payload: unknown, opts: { onConflict: string }) {
            ultimoUpsert = { payload, onConflict: opts.onConflict };
            return Promise.resolve(erroForcado ? { data: null, error: erroForcado } : { data: [payload], error: null });
          },
        }),
      },
      getUltimoUpsert: () => ultimoUpsert,
      forcarErro: (erro: { code: string } | null) => {
        erroForcado = erro;
      },
    };
  }

  return { fake: criarFakeSupabase() };
});

vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => fake.client }));

const { upsertExternalId } = await import("./external-ids");

describe("upsertExternalId", () => {
  beforeEach(() => {
    fake.forcarErro(null);
  });

  it("faz upsert com a chave de dedupe pedida (clínica + provider + tipo + id externo)", async () => {
    const r = await upsertExternalId("clinica-1", "consulta", "ext-1", { metadata: { status: "agendado" } });
    expect(r).toEqual({ ok: true });
    expect(fake.getUltimoUpsert()?.onConflict).toBe("clinica_id,provider,entity_type,external_id");
  });

  it("a mesma chamada repetida (polling reencontrando o mesmo agendamento) não é tratada como erro", async () => {
    await upsertExternalId("clinica-1", "consulta", "ext-1");
    await expect(upsertExternalId("clinica-1", "consulta", "ext-1")).resolves.toEqual({ ok: true });
  });

  it("erro do banco vira { ok: false }, nunca lança", async () => {
    fake.forcarErro({ code: "23505" });
    await expect(upsertExternalId("clinica-1", "consulta", "ext-1")).resolves.toEqual({ ok: false, error: "upsert_failed" });
  });
});
