import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarFakeDb, type FakeDb } from "@/lib/fake-supabase.testutil";

let db: FakeDb;
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => db.client }));
vi.mock("@/lib/evolution-status", () => ({ buscarStatusConexao: vi.fn(async () => ({ conectado: true, numero: "5561999990000", erro: undefined })) }));

import {
  apiKeyDoCanal,
  atualizarCanal,
  buscarCanalDaConversa,
  buscarCanalPorInstancia,
  buscarCanalPrincipal,
  credencialRefValida,
  criarCanal,
  decidirEnvioCanal,
  definirCanalPrincipal,
  listarCanais,
  paraPublico,
  tokensAceitosWebhook,
  verificarSaudeCanal,
  type Canal,
} from "@/lib/canais";

const CLINICA_A = "clinica-a";
const CLINICA_B = "clinica-b";

function novoDb(iniciais: Record<string, Record<string, unknown>[]> = {}) {
  db = criarFakeDb({ canais: [["provider", "provider_instance_id"]] }, iniciais);
}

beforeEach(() => {
  delete process.env.EVOLUTION_INSTANCE;
  novoDb();
});

describe("criarCanal / listarCanais", () => {
  it("cria o canal na clínica certa e o 1º vira principal", async () => {
    const r = await criarCanal(CLINICA_A, { nome: "  WhatsApp Recepção ", providerInstanceId: "inst-recepcao" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.canal).toMatchObject({ clinicaId: CLINICA_A, nome: "WhatsApp Recepção", tipo: "whatsapp", provider: "evolution", principal: true, ativo: true });
  });

  it("o 2º canal NÃO vira principal", async () => {
    await criarCanal(CLINICA_A, { nome: "Recepção", providerInstanceId: "inst-1" });
    const r = await criarCanal(CLINICA_A, { nome: "Comercial", providerInstanceId: "inst-2" });
    expect(r.ok && r.canal.principal).toBe(false);
  });

  it("rejeita nome vazio, nome enorme, instância inválida e instância repetida", async () => {
    expect(await criarCanal(CLINICA_A, { nome: " ", providerInstanceId: "x1" })).toEqual({ ok: false, error: "nome_vazio" });
    expect(await criarCanal(CLINICA_A, { nome: "a".repeat(61), providerInstanceId: "x1" })).toEqual({ ok: false, error: "nome_muito_longo" });
    expect(await criarCanal(CLINICA_A, { nome: "Ok", providerInstanceId: "com espaço" })).toEqual({ ok: false, error: "instancia_invalida" });
    await criarCanal(CLINICA_A, { nome: "Um", providerInstanceId: "inst-1" });
    expect(await criarCanal(CLINICA_B, { nome: "Outro", providerInstanceId: "inst-1" })).toEqual({ ok: false, error: "instancia_ja_cadastrada" });
  });

  it("credencial_ref só aceita EVOLUTION_* (nunca lê a service role key do ambiente)", async () => {
    expect(await criarCanal(CLINICA_A, { nome: "X", providerInstanceId: "inst-x", credencialRef: "SUPABASE_SERVICE_ROLE_KEY" })).toEqual({
      ok: false,
      error: "credencial_ref_invalida",
    });
    expect((await criarCanal(CLINICA_A, { nome: "X", providerInstanceId: "inst-x", credencialRef: "EVOLUTION_TOKEN_X" })).ok).toBe(true);
  });

  it("clínica A não vê canais da B", async () => {
    await criarCanal(CLINICA_A, { nome: "A1", providerInstanceId: "a1" });
    await criarCanal(CLINICA_B, { nome: "B1", providerInstanceId: "b1" });
    expect((await listarCanais(CLINICA_A)).map((c) => c.nome)).toEqual(["A1"]);
    expect((await listarCanais(CLINICA_B)).map((c) => c.nome)).toEqual(["B1"]);
  });

  it("canal público nunca carrega credencial_ref", async () => {
    const r = await criarCanal(CLINICA_A, { nome: "X", providerInstanceId: "inst-x", credencialRef: "EVOLUTION_TOKEN_X" });
    if (!r.ok) throw new Error("falhou");
    expect(JSON.stringify(paraPublico(r.canal))).not.toContain("EVOLUTION_TOKEN_X");
    expect("credencialRef" in paraPublico(r.canal)).toBe(false);
  });
});

describe("canal principal", () => {
  it("buscarCanalPrincipal devolve o principal da clínica", async () => {
    await criarCanal(CLINICA_A, { nome: "P", providerInstanceId: "p1" });
    await criarCanal(CLINICA_A, { nome: "S", providerInstanceId: "s1" });
    expect((await buscarCanalPrincipal(CLINICA_A))?.nome).toBe("P");
  });

  it("clínica sem canal ganha o principal a partir de EVOLUTION_INSTANCE (deploy novo funciona sozinho)", async () => {
    process.env.EVOLUTION_INSTANCE = "inst-do-deploy";
    const c = await buscarCanalPrincipal(CLINICA_A);
    expect(c).toMatchObject({ providerInstanceId: "inst-do-deploy", principal: true, clinicaId: CLINICA_A });
  });

  it("clínica sem canal e sem env → null (falha controlada, nada inventado)", async () => {
    expect(await buscarCanalPrincipal(CLINICA_A)).toBeNull();
  });

  it("clínica COM canais mas nenhum principal → null: nunca escolhe um 'qualquer'", async () => {
    novoDb({ canais: [{ id: "c1", clinica_id: CLINICA_A, nome: "X", provider: "evolution", provider_instance_id: "i1", principal: false, ativo: true }] });
    process.env.EVOLUTION_INSTANCE = "inst-do-deploy";
    expect(await buscarCanalPrincipal(CLINICA_A)).toBeNull();
  });

  it("não pausa o canal principal", async () => {
    const r = await criarCanal(CLINICA_A, { nome: "P", providerInstanceId: "p1" });
    if (!r.ok) throw new Error("falhou");
    expect(await atualizarCanal(CLINICA_A, r.canal.id, { ativo: false })).toEqual({ ok: false, error: "canal_principal_nao_pode_pausar" });
  });

  it("definirCanalPrincipal usa a RPC atômica e respeita a clínica", async () => {
    db.rpcHandlers.definir_canal_principal = () => ({ ok: true });
    expect(await definirCanalPrincipal(CLINICA_A, "canal-x")).toEqual({ ok: true });
    db.rpcHandlers.definir_canal_principal = () => ({ ok: false, error: "canal_invalido" });
    expect(await definirCanalPrincipal(CLINICA_A, "canal-de-outra-clinica")).toEqual({ ok: false, error: "canal_invalido" });
  });
});

describe("mapeamento provider/instância", () => {
  it("resolve o canal pela instância do provider (a autoridade do webhook)", async () => {
    await criarCanal(CLINICA_A, { nome: "A", providerInstanceId: "inst-a" });
    await criarCanal(CLINICA_B, { nome: "B", providerInstanceId: "inst-b" });
    expect((await buscarCanalPorInstancia("evolution", "inst-b"))?.clinicaId).toBe(CLINICA_B);
    expect(await buscarCanalPorInstancia("evolution", "inst-nao-existe")).toBeNull();
    expect(await buscarCanalPorInstancia("instagram", "inst-a")).toBeNull();
  });

  it("conversa → seu canal; conversa legada sem canal → principal (nunca outro)", async () => {
    novoDb({
      canais: [
        { id: "cp", clinica_id: CLINICA_A, nome: "Principal", provider: "evolution", provider_instance_id: "ip", principal: true, ativo: true },
        { id: "cs", clinica_id: CLINICA_A, nome: "Comercial", provider: "evolution", provider_instance_id: "is", principal: false, ativo: true },
      ],
      conversas: [
        { id: "conv-1", clinica_id: CLINICA_A, canal_id: "cs" },
        { id: "conv-legada", clinica_id: CLINICA_A, canal_id: null },
      ],
    });
    expect((await buscarCanalDaConversa(CLINICA_A, "conv-1"))?.nome).toBe("Comercial");
    expect((await buscarCanalDaConversa(CLINICA_A, "conv-legada"))?.nome).toBe("Principal");
    expect(await buscarCanalDaConversa(CLINICA_B, "conv-1")).toBeNull();
  });
});

const canalBase: Canal = {
  id: "c1", clinicaId: CLINICA_A, nome: "X", tipo: "whatsapp", provider: "evolution", providerInstanceId: "i", telefone: null,
  status: "connected", ativo: true, principal: false, credencialRef: null, lastWebhookAt: null, lastMessageInAt: null, lastMessageOutAt: null, lastError: null,
};

describe("decidirEnvioCanal", () => {
  it("canal ativo e conectado envia", () => {
    expect(decidirEnvioCanal(canalBase)).toEqual({ pode: true });
  });
  it("canal pausado NÃO envia (sem fallback)", () => {
    expect(decidirEnvioCanal({ ...canalBase, ativo: false })).toEqual({ pode: false, error: "canal_pausado" });
  });
  it("status salvo 'desconectado' só bloqueia se o provider ao vivo também disser que não", () => {
    expect(decidirEnvioCanal({ ...canalBase, status: "disconnected" })).toEqual({ pode: false, error: "canal_indisponivel" });
    expect(decidirEnvioCanal({ ...canalBase, status: "disconnected" }, false)).toEqual({ pode: false, error: "canal_indisponivel" });
    expect(decidirEnvioCanal({ ...canalBase, status: "disconnected" }, true)).toEqual({ pode: true });
  });
  it("status desconhecido não trava o envio (o provider decide)", () => {
    expect(decidirEnvioCanal({ ...canalBase, status: "unknown" })).toEqual({ pode: true });
  });
  it("provider/tipo ainda não suportado falha controlado", () => {
    expect(decidirEnvioCanal({ ...canalBase, tipo: "instagram", provider: "meta" })).toEqual({ pode: false, error: "provider_nao_suportado" });
  });
});

describe("credenciais", () => {
  it("credencialRefValida", () => {
    expect(credencialRefValida("EVOLUTION_TOKEN_RECEPCAO")).toBe(true);
    for (const ruim of ["SUPABASE_SERVICE_ROLE_KEY", "evolution_token", "EVOLUTION_", "EVOLUTION_a b", null, undefined, ""]) {
      expect(credencialRefValida(ruim as string | null)).toBe(false);
    }
  });
  it("apiKeyDoCanal lê só a env apontada por credencial_ref válido", () => {
    const env = { EVOLUTION_TOKEN_A: "seg-a", SUPABASE_SERVICE_ROLE_KEY: "nao-pode" } as unknown as NodeJS.ProcessEnv;
    expect(apiKeyDoCanal({ credencialRef: "EVOLUTION_TOKEN_A" }, env)).toBe("seg-a");
    expect(apiKeyDoCanal({ credencialRef: "SUPABASE_SERVICE_ROLE_KEY" }, env)).toBeNull();
    expect(apiKeyDoCanal({ credencialRef: null }, env)).toBeNull();
  });
  it("tokensAceitosWebhook junta global + instância legada + token do canal, sem vazios", () => {
    const env = { EVOLUTION_API_KEY: "g", EVOLUTION_TOKEN_A: "a" } as unknown as NodeJS.ProcessEnv;
    expect(tokensAceitosWebhook({ credencialRef: "EVOLUTION_TOKEN_A" }, env)).toEqual(["g", "a"]);
    expect(tokensAceitosWebhook(null, env)).toEqual(["g"]);
  });
});

describe("verificarSaudeCanal", () => {
  it("consulta o provider ao vivo e grava status/telefone (o salvo não é a única fonte)", async () => {
    novoDb({ canais: [{ id: "c1", clinica_id: CLINICA_A, nome: "X", provider: "evolution", provider_instance_id: "i", status: "disconnected", telefone: null, principal: true, ativo: true }] });
    const canal = (await listarCanais(CLINICA_A))[0];
    const saude = await verificarSaudeCanal(canal);
    expect(saude).toMatchObject({ status: "connected", conectadoAoVivo: true, telefone: "5561999990000" });
    expect(db.tables.canais[0]).toMatchObject({ status: "connected", telefone: "5561999990000" });
  });
});
