import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarFakeDb, type FakeDb } from "@/lib/fake-supabase.testutil";

let db: FakeDb;

vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => db.client }));

const processarMensagemRecebida = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/agentes-buffer", () => ({ processarMensagemRecebida: (...a: unknown[]) => processarMensagemRecebida(...(a as [])) }));

const resolverRespostaWaitingInput = vi.fn(async () => true);
const tentarIniciarFluxoPorMensagem = vi.fn(async () => false);
vi.mock("@/lib/fluxo-execucoes", () => ({
  cancelarExecucoesAtivasDoPaciente: vi.fn(async () => undefined),
  resolverRespostaWaitingInput: (...a: unknown[]) => resolverRespostaWaitingInput(...(a as [])),
  tentarIniciarFluxoPorMensagem: (...a: unknown[]) => tentarIniciarFluxoPorMensagem(...(a as [])),
}));

import { POST } from "@/app/api/webhook/evolution/route";

const CLINICA_1 = "clinica-1";
const CLINICA_2 = "clinica-2";

function canal(id: string, instancia: string, clinicaId = CLINICA_1, extra: Record<string, unknown> = {}) {
  return { id, clinica_id: clinicaId, nome: id, tipo: "whatsapp", provider: "evolution", provider_instance_id: instancia, status: "connected", ativo: true, principal: false, ...extra };
}

function evento(instance: string, telefone: string, texto: string, id: string, apikey = "chave-global") {
  return new Request("http://crm.test/api/webhook/evolution", {
    method: "POST",
    body: JSON.stringify({
      event: "messages.upsert",
      instance,
      apikey,
      data: {
        key: { remoteJid: `${telefone}@s.whatsapp.net`, fromMe: false, id },
        pushName: "Maria",
        message: { conversation: texto },
        messageType: "conversation",
        messageTimestamp: 1758000000,
      },
    }),
  });
}

function novoDb(canais: Record<string, unknown>[], extras: Record<string, Record<string, unknown>[]> = {}) {
  db = criarFakeDb(
    { conversas: [["clinica_id", "canal_id", "telefone"]], pacientes: [["clinica_id", "telefone"]], mensagens: [["evolution_message_id"]] },
    { canais, ...extras }
  );
}

beforeEach(() => {
  process.env.EVOLUTION_API_KEY = "chave-global";
  delete process.env.EVOLUTION_INSTANCE_TOKEN;
  processarMensagemRecebida.mockClear();
  resolverRespostaWaitingInput.mockClear();
  tentarIniciarFluxoPorMensagem.mockClear();
  novoDb([canal("canal-a", "inst-a", CLINICA_1, { principal: true }), canal("canal-b", "inst-b"), canal("canal-c2", "inst-c2", CLINICA_2)]);
});

describe("webhook Evolution — roteamento por canal", () => {
  it("instância A → canal A; instância B → canal B", async () => {
    await POST(evento("inst-a", "5561999990001", "oi", "m1"));
    await POST(evento("inst-b", "5561999990002", "oi", "m2"));

    const porTel = (t: string) => db.tables.conversas.find((c) => c.telefone === t);
    expect(porTel("5561999990001")?.canal_id).toBe("canal-a");
    expect(porTel("5561999990002")?.canal_id).toBe("canal-b");
  });

  it("mesmo telefone nos dois canais → mesmo paciente, conversas distintas (sem fusão)", async () => {
    await POST(evento("inst-a", "5561999990001", "oi recepção", "m1"));
    await POST(evento("inst-b", "5561999990001", "oi comercial", "m2"));

    expect(db.tables.pacientes).toHaveLength(1);
    expect(db.tables.conversas).toHaveLength(2);
    expect(new Set(db.tables.conversas.map((c) => c.canal_id))).toEqual(new Set(["canal-a", "canal-b"]));
    expect(new Set(db.tables.conversas.map((c) => c.paciente_id)).size).toBe(1);
    // segunda mensagem no mesmo canal reaproveita a conversa (não duplica)
    await POST(evento("inst-a", "5561999990001", "de novo", "m3"));
    expect(db.tables.conversas).toHaveLength(2);
    expect(db.tables.mensagens).toHaveLength(3);
  });

  it("instância desconhecida com chave válida → skipped, NADA é criado", async () => {
    const res = await POST(evento("inst-fantasma", "5561999990001", "oi", "m1"));
    expect(await res.json()).toEqual({ ok: true, skipped: "unknown_instance" });
    expect(db.tables.pacientes ?? []).toHaveLength(0);
    expect(db.tables.conversas ?? []).toHaveLength(0);
    expect(db.tables.mensagens ?? []).toHaveLength(0);
  });

  it("chave inválida → 401, com canal conhecido ou não", async () => {
    expect((await POST(evento("inst-a", "5561999990001", "oi", "m1", "chave-errada"))).status).toBe(401);
    expect((await POST(evento("inst-fantasma", "5561999990001", "oi", "m2", "chave-errada"))).status).toBe(401);
    expect(db.tables.conversas ?? []).toHaveLength(0);
  });

  it("a clínica vem do CANAL: instância da clínica 2 grava tudo na clínica 2", async () => {
    await POST(evento("inst-c2", "5561999990009", "oi", "m1"));
    expect(db.tables.conversas[0].clinica_id).toBe(CLINICA_2);
    expect(db.tables.pacientes[0].clinica_id).toBe(CLINICA_2);
    expect(db.tables.mensagens[0].clinica_id).toBe(CLINICA_2);
  });

  it("token por canal (credencial_ref) é aceito só pra aquele canal", async () => {
    process.env.EVOLUTION_TOKEN_RECEPCAO = "token-da-recepcao";
    novoDb([canal("canal-a", "inst-a", CLINICA_1, { principal: true, credencial_ref: "EVOLUTION_TOKEN_RECEPCAO" }), canal("canal-b", "inst-b")]);

    expect((await POST(evento("inst-a", "5561999990001", "oi", "m1", "token-da-recepcao"))).status).toBe(200);
    expect((await POST(evento("inst-b", "5561999990002", "oi", "m2", "token-da-recepcao"))).status).toBe(401);
    delete process.env.EVOLUTION_TOKEN_RECEPCAO;
  });

  it("mensagem do paciente numa conversa finalizada reabre (limpa finalizada_em)", async () => {
    await POST(evento("inst-a", "5561999990001", "oi", "m1"));
    db.tables.conversas[0].finalizada_em = "2026-09-19T10:00:00Z";
    db.tables.conversas[0].status = "respondido";

    await POST(evento("inst-a", "5561999990001", "voltei", "m2"));
    expect(db.tables.conversas[0].finalizada_em).toBeNull();
  });

  it("registra atividade do canal (last_webhook_at) sem segredo", async () => {
    await POST(evento("inst-a", "5561999990001", "oi", "m1"));
    await new Promise((r) => setTimeout(r, 0));
    const c = db.tables.canais.find((x) => x.id === "canal-a")!;
    expect(typeof c.last_webhook_at).toBe("string");
    expect(JSON.stringify(c)).not.toContain("chave-global");
  });
});

describe("webhook Evolution — ownership IA × Humano × Fluxo", () => {
  async function conversaCom(estado: Record<string, unknown>) {
    await POST(evento("inst-a", "5561999990001", "primeira", "m0"));
    Object.assign(db.tables.conversas[0], estado);
    processarMensagemRecebida.mockClear();
    resolverRespostaWaitingInput.mockClear();
    tentarIniciarFluxoPorMensagem.mockClear();
  }

  it("Fluxo em waiting_input continua capturando a resposta mesmo com responsável humano atribuído", async () => {
    await conversaCom({ dono_conversa: "fluxo", fluxo_execucao_ativa_id: "exec-1", atribuido_a: "juliana" });
    await POST(evento("inst-a", "5561999990001", "1", "m1"));

    expect(resolverRespostaWaitingInput).toHaveBeenCalledTimes(1);
    expect(processarMensagemRecebida).not.toHaveBeenCalled();
  });

  it("humano é dono (assumiu): nem IA nem Fluxo respondem", async () => {
    await conversaCom({ dono_conversa: "humano", atribuido_a: "juliana", agente_ativo_id: "agente-1" });
    await POST(evento("inst-a", "5561999990001", "preciso de ajuda", "m1"));

    expect(processarMensagemRecebida).not.toHaveBeenCalled();
    expect(resolverRespostaWaitingInput).not.toHaveBeenCalled();
    expect(tentarIniciarFluxoPorMensagem).not.toHaveBeenCalled();
  });

  it("IA é dona: a IA responde (uma vez) e o Fluxo não é chamado em duplicidade", async () => {
    await conversaCom({ dono_conversa: "agente_ia", agente_ativo_id: "agente-1", agente_pausado_ate: null });
    await POST(evento("inst-a", "5561999990001", "oi", "m1"));

    expect(processarMensagemRecebida).toHaveBeenCalledTimes(1);
    expect(resolverRespostaWaitingInput).not.toHaveBeenCalled();
  });

  it("canal pausado: a mensagem é espelhada, mas nenhuma automação tenta responder", async () => {
    novoDb([canal("canal-a", "inst-a", CLINICA_1, { principal: true, ativo: false })]);
    await POST(evento("inst-a", "5561999990001", "oi", "m1"));
    expect(db.tables.mensagens).toHaveLength(1);

    Object.assign(db.tables.conversas[0], { dono_conversa: "agente_ia", agente_ativo_id: "agente-1" });
    await POST(evento("inst-a", "5561999990001", "oi de novo", "m2"));
    expect(processarMensagemRecebida).not.toHaveBeenCalled();
  });
});
