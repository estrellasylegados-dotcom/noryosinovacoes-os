/* eslint-disable @typescript-eslint/no-unused-vars -- stubs de teste ignoram argumentos de propósito */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarFakeDb, type FakeDb } from "@/lib/fake-supabase.testutil";

let db: FakeDb;
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => db.client }));

const enviarTextoEvolution = vi.fn(async (..._a: unknown[]) => ({ ok: true, mensagemId: "wamid-1" }));
vi.mock("@/lib/evolution-send", () => ({ enviarTextoEvolution: (...a: unknown[]) => enviarTextoEvolution(...a) }));

const buscarStatusConexao = vi.fn(async (..._a: unknown[]) => ({ conectado: true as boolean | null }));
vi.mock("@/lib/evolution-status", () => ({ buscarStatusConexao: (...a: unknown[]) => buscarStatusConexao(...a) }));

import { enviarNaConversa, enviarPeloCanalPrincipal, mensagemErroEnvio } from "@/lib/canais-envio";

const CLINICA = "clinica-1";

function canal(id: string, instancia: string, extra: Record<string, unknown> = {}) {
  return { id, clinica_id: CLINICA, nome: id, tipo: "whatsapp", provider: "evolution", provider_instance_id: instancia, status: "connected", ativo: true, principal: false, ...extra };
}

beforeEach(() => {
  enviarTextoEvolution.mockClear();
  buscarStatusConexao.mockReset();
  buscarStatusConexao.mockResolvedValue({ conectado: true });
  db = criarFakeDb(
    {},
    {
      canais: [
        canal("canal-a", "inst-a", { principal: true }),
        canal("canal-b", "inst-b"),
        canal("canal-pausado", "inst-p", { ativo: false }),
        canal("canal-off", "inst-off", { status: "disconnected" }),
      ],
      conversas: [
        { id: "conv-a", clinica_id: CLINICA, canal_id: "canal-a" },
        { id: "conv-b", clinica_id: CLINICA, canal_id: "canal-b" },
        { id: "conv-pausada", clinica_id: CLINICA, canal_id: "canal-pausado" },
        { id: "conv-off", clinica_id: CLINICA, canal_id: "canal-off" },
      ],
    }
  );
});

describe("envio: conversa → canal → instância", () => {
  it("conversa do canal A envia pela instância A", async () => {
    const r = await enviarNaConversa(CLINICA, "conv-a", "5561999990001", "olá");
    expect(r).toMatchObject({ ok: true, canalId: "canal-a" });
    expect(enviarTextoEvolution).toHaveBeenCalledWith("inst-a", "5561999990001", "olá", null);
  });

  it("conversa do canal B envia pela instância B", async () => {
    await enviarNaConversa(CLINICA, "conv-b", "5561999990001", "olá");
    expect(enviarTextoEvolution.mock.calls[0][0]).toBe("inst-b");
  });

  it("canal pausado: falha CONTROLADA, nada é enviado e não há fallback pro principal", async () => {
    const r = await enviarNaConversa(CLINICA, "conv-pausada", "5561999990001", "olá");
    expect(r).toMatchObject({ ok: false, error: "canal_pausado" });
    expect(enviarTextoEvolution).not.toHaveBeenCalled();
  });

  it("canal desconectado (salvo e ao vivo): falha controlada, sem envio e sem trocar de número", async () => {
    buscarStatusConexao.mockResolvedValue({ conectado: false });
    const r = await enviarNaConversa(CLINICA, "conv-off", "5561999990001", "olá");
    expect(r).toMatchObject({ ok: false, error: "canal_indisponivel" });
    expect(enviarTextoEvolution).not.toHaveBeenCalled();
  });

  it("status salvo velho ('desconectado') mas provider ao vivo conectado: envia", async () => {
    buscarStatusConexao.mockResolvedValue({ conectado: true });
    const r = await enviarNaConversa(CLINICA, "conv-off", "5561999990001", "olá");
    expect(r.ok).toBe(true);
    expect(enviarTextoEvolution.mock.calls[0][0]).toBe("inst-off");
  });

  it("conversa que não existe (ou é de outra clínica) → canal_nao_encontrado", async () => {
    expect(await enviarNaConversa(CLINICA, "conv-fantasma", "5561999990001", "olá")).toMatchObject({ ok: false, error: "canal_nao_encontrado" });
    expect(await enviarNaConversa("outra-clinica", "conv-a", "5561999990001", "olá")).toMatchObject({ ok: false, error: "canal_nao_encontrado" });
    expect(enviarTextoEvolution).not.toHaveBeenCalled();
  });

  it("falha do provider volta como erro e fica registrada em last_error do canal (sem segredo)", async () => {
    enviarTextoEvolution.mockResolvedValueOnce({ ok: false, mensagemId: undefined, error: "http_500" } as never);
    const r = await enviarNaConversa(CLINICA, "conv-a", "5561999990001", "olá");
    expect(r).toMatchObject({ ok: false, error: "http_500" });
    await new Promise((res) => setTimeout(res, 0));
    expect(db.tables.canais.find((c) => c.id === "canal-a")?.last_error).toBe("http_500");
  });
});

describe("envio sem conversa: canal principal", () => {
  it("usa o principal da clínica", async () => {
    await enviarPeloCanalPrincipal(CLINICA, "5561999990001", "alerta");
    expect(enviarTextoEvolution.mock.calls[0][0]).toBe("inst-a");
  });

  it("clínica sem canal principal: falha controlada, nunca escolhe outro", async () => {
    const r = await enviarPeloCanalPrincipal("clinica-sem-canal", "5561999990001", "alerta");
    expect(r).toMatchObject({ ok: false, error: "canal_nao_encontrado" });
    expect(enviarTextoEvolution).not.toHaveBeenCalled();
  });
});

describe("mensagemErroEnvio", () => {
  it("traduz erros de canal pra texto operacional", () => {
    expect(mensagemErroEnvio("canal_pausado")).toMatch(/pausado/);
    expect(mensagemErroEnvio("canal_indisponivel")).toMatch(/desconectado/);
    expect(mensagemErroEnvio("http_500")).toMatch(/Não foi possível enviar/);
  });
});
