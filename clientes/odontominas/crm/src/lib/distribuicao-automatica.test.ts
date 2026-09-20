import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarFakeDb, type FakeDb } from "@/lib/fake-supabase.testutil";
import { salvarConfigDistribuicao } from "@/lib/distribuicao-automatica";

let db: FakeDb;
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => db.client }));

const registrarEvento = vi.fn(async (entrada: unknown) => {
  void entrada;
});
vi.mock("@/lib/auditoria", () => ({ registrarEvento: (a: unknown) => registrarEvento(a) }));

describe("salvarConfigDistribuicao", () => {
  beforeEach(() => {
    registrarEvento.mockClear();
    db = criarFakeDb({}, { atendimento_config: [] });
  });

  it("valida payload minimo", async () => {
    expect(await salvarConfigDistribuicao("c1", { ativa: "sim" }, { atendenteId: "a1", perfil: "dona" })).toEqual({ ok: false, error: "invalid_body" });
    expect(await salvarConfigDistribuicao("c1", { estrategia: "carga" }, { atendenteId: "a1", perfil: "dona" })).toEqual({ ok: false, error: "estrategia_invalida" });
  });

  it("salva toggle e audita mudanca", async () => {
    const r = await salvarConfigDistribuicao("c1", { ativa: true, estrategia: "round_robin" }, { atendenteId: "a1", perfil: "dona" });
    expect(r).toEqual({ ok: true, config: { ativa: true, estrategia: "round_robin" } });
    expect(db.tables.atendimento_config[0]).toMatchObject({ clinica_id: "c1", auto_distribuicao_ativa: true, auto_distribuicao_estrategia: "round_robin" });
    expect(registrarEvento).toHaveBeenCalledWith(expect.objectContaining({ evento: "AUTO_DISTRIBUTION_ENABLED", atorId: "a1" }));
  });
});
