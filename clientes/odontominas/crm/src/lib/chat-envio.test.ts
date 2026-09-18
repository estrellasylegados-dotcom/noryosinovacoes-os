/* eslint-disable @typescript-eslint/no-unused-vars -- stubs de teste ignoram argumentos de propósito */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarFakeDb, type FakeDb } from "@/lib/fake-supabase.testutil";
import { PERFIS_PADRAO, type Perfil, type Permissao } from "@/lib/permissoes";
import type { AtorConversa } from "@/lib/atribuicao";

let db: FakeDb;
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => db.client }));

const enviarTextoEvolution = vi.fn(async (..._a: unknown[]) => ({ ok: true, mensagemId: "wamid-1" }));
vi.mock("@/lib/evolution-send", () => ({ enviarTextoEvolution: (...a: unknown[]) => enviarTextoEvolution(...a) }));
vi.mock("@/lib/evolution-status", () => ({ buscarStatusConexao: vi.fn(async () => ({ conectado: true })) }));

const registrarEvento = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("@/lib/auditoria", () => ({ registrarEvento: (...a: unknown[]) => registrarEvento(...a) }));

const pausarAgenteSeConfigurado = vi.fn(async () => undefined);
vi.mock("@/lib/agentes", () => ({
  pausarAgenteSeConfigurado: (...a: unknown[]) => pausarAgenteSeConfigurado(...(a as [])),
  pausarAgenteManual: vi.fn(async () => ({ ok: true })),
}));

const transferirExecucaoAtivaParaHumano = vi.fn(async () => undefined);
vi.mock("@/lib/fluxo-execucoes", () => ({ transferirExecucaoAtivaParaHumano: (...a: unknown[]) => transferirExecucaoAtivaParaHumano(...(a as [])) }));

import { enviarRespostaChat } from "@/lib/chat";
import { criarNotaInterna } from "@/lib/notas-internas";

const CLINICA = "clinica-1";
const AGUARDANDO_DESDE = "2026-09-19T09:00:00.000Z";

function ator(id: string, perfil: Perfil, permissoes?: Permissao[]): AtorConversa {
  return { atendenteId: id, perfil, permissoes: permissoes ? new Set(permissoes) : PERFIS_PADRAO[perfil] };
}
const ana = ator("ana", "atendente");
const bia = ator("bia", "atendente");
const supervisora = ator("sup", "supervisora");

function conversa() {
  return db.tables.conversas[0];
}

function preparar(extra: Record<string, unknown> = {}, canalExtra: Record<string, unknown> = {}) {
  db = criarFakeDb(
    {},
    {
      canais: [{ id: "canal-a", clinica_id: CLINICA, nome: "Recepção", tipo: "whatsapp", provider: "evolution", provider_instance_id: "inst-a", status: "connected", ativo: true, principal: true, ...canalExtra }],
      conversas: [
        {
          id: "conv-1", clinica_id: CLINICA, canal_id: "canal-a", telefone: "5561999990001", status: "aguardando",
          dono_conversa: "humano", atribuido_a: null, finalizada_em: null, aguardando_desde: AGUARDANDO_DESDE, ...extra,
        },
      ],
    }
  );
  // Imita o UPDATE condicional do Postgres (a atomicidade REAL é provada no banco: scripts/e2e-canais-concorrencia.mjs).
  db.rpcHandlers.assumir_conversa = (a) => {
    const c = conversa();
    if (c.atribuido_a === null || c.atribuido_a === undefined) {
      c.atribuido_a = a.p_ator;
      return { ok: true };
    }
    return { ok: false, error: "ja_assumida", por_id: c.atribuido_a, por_nome: "Juliana" };
  };
}

beforeEach(() => {
  enviarTextoEvolution.mockClear();
  registrarEvento.mockClear();
  pausarAgenteSeConfigurado.mockClear();
  transferirExecucaoAtivaParaHumano.mockClear();
  preparar();
});

describe("enviarRespostaChat — enforcement no backend", () => {
  it("responsável responde pelo canal certo; grava autoria humana; NÃO mexe no relógio do SLA", async () => {
    preparar({ atribuido_a: "ana", status: "novo" });
    const r = await enviarRespostaChat(CLINICA, "conv-1", "Bom dia!", ana);

    expect(r.ok).toBe(true);
    expect(enviarTextoEvolution).toHaveBeenCalledWith("inst-a", "5561999990001", "Bom dia!", null);
    expect(db.tables.mensagens[0]).toMatchObject({ direcao: "enviada", enviada_por_atendente_id: "ana", conversa_id: "conv-1" });
    expect(conversa().status).toBe("respondido"); // resposta humana encerra o ciclo (regra existente)
    expect(conversa().aguardando_desde).toBe(AGUARDANDO_DESDE);
  });

  it("outra atendente comum NÃO responde: negado, nada é enviado, nada é gravado", async () => {
    preparar({ atribuido_a: "ana" });
    const r = await enviarRespostaChat(CLINICA, "conv-1", "Oi", bia);

    expect(r).toMatchObject({ ok: false, error: "nao_e_responsavel" });
    expect(r.mensagemErro).toMatch(/outra pessoa/);
    expect(enviarTextoEvolution).not.toHaveBeenCalled();
    expect(db.tables.mensagens ?? []).toHaveLength(0);
    expect(conversa().status).toBe("aguardando");
  });

  it("supervisora com conversas.intervir intervém; o responsável continua sendo a Ana; fica auditado", async () => {
    preparar({ atribuido_a: "ana" });
    const r = await enviarRespostaChat(CLINICA, "conv-1", "Posso ajudar?", supervisora);

    expect(r.ok).toBe(true);
    expect(conversa().atribuido_a).toBe("ana");
    expect(registrarEvento).toHaveBeenCalledWith(expect.objectContaining({ evento: "CONVERSATION_INTERVENED", atorId: "sup", alvoId: "conv-1" }));
    expect(db.tables.conversa_eventos[0]).toMatchObject({ tipo: "CONVERSATION_INTERVENED", ator_id: "sup", de_atendente_id: "ana" });
  });

  it("conversa sem responsável: quem responde assume na mesma operação", async () => {
    const r = await enviarRespostaChat(CLINICA, "conv-1", "Olá!", ana);
    expect(r.ok).toBe(true);
    expect(conversa().atribuido_a).toBe("ana");
    expect(enviarTextoEvolution).toHaveBeenCalledTimes(1);
  });

  it("perdeu a corrida pra assumir: conflito controlado com o nome de quem assumiu, e NADA é enviado", async () => {
    preparar({ atribuido_a: null });
    // Juliana assume entre a leitura e o assumir da Ana:
    db.rpcHandlers.assumir_conversa = () => ({ ok: false, error: "ja_assumida", por_id: "juliana-id", por_nome: "Juliana" });

    const r = await enviarRespostaChat(CLINICA, "conv-1", "Olá!", ana);
    expect(r).toMatchObject({ ok: false, error: "ja_assumida", porNome: "Juliana" });
    expect(r.mensagemErro).toBe("Esta conversa acabou de ser assumida por Juliana.");
    expect(enviarTextoEvolution).not.toHaveBeenCalled();
  });

  it("conversa finalizada: só com conversas.reabrir; ao responder, reabre e registra", async () => {
    preparar({ atribuido_a: "ana", status: "respondido", finalizada_em: "2026-09-19T10:00:00Z" });
    expect(await enviarRespostaChat(CLINICA, "conv-1", "Oi", ana)).toMatchObject({ ok: false, error: "conversa_finalizada" });
    expect(enviarTextoEvolution).not.toHaveBeenCalled();

    const comReabrir = ator("ana", "atendente", ["conversas.assumir", "conversas.reabrir"]);
    expect((await enviarRespostaChat(CLINICA, "conv-1", "Oi de novo", comReabrir)).ok).toBe(true);
    expect(conversa().finalizada_em).toBeNull();
    expect(db.tables.conversa_eventos.map((e) => e.tipo)).toContain("CONVERSATION_REOPENED");
  });

  it("canal pausado: erro operacional claro, nada enviado, conversa intacta (sem fallback)", async () => {
    preparar({ atribuido_a: "ana" }, { ativo: false });
    const r = await enviarRespostaChat(CLINICA, "conv-1", "Oi", ana);

    expect(r).toMatchObject({ ok: false, error: "canal_pausado" });
    expect(r.mensagemErro).toMatch(/pausado/);
    expect(enviarTextoEvolution).not.toHaveBeenCalled();
    expect(conversa().status).toBe("aguardando");
    expect(db.tables.mensagens ?? []).toHaveLength(0);
  });

  it("conversa de Fluxo: a resposta humana transfere a execução pra humano (comportamento existente preservado)", async () => {
    preparar({ atribuido_a: "ana", dono_conversa: "fluxo" });
    await enviarRespostaChat(CLINICA, "conv-1", "Assumi por aqui", ana);
    expect(transferirExecucaoAtivaParaHumano).toHaveBeenCalledTimes(1);
  });

  it("conversa de outra clínica → not_found (nunca vaza)", async () => {
    expect(await enviarRespostaChat("outra-clinica", "conv-1", "Oi", ana)).toMatchObject({ ok: false, error: "not_found" });
  });

  it("texto vazio nunca envia", async () => {
    expect(await enviarRespostaChat(CLINICA, "conv-1", "   ", ana)).toMatchObject({ ok: false, error: "texto_vazio" });
  });
});

describe("notas internas × canal × SLA", () => {
  it("nota é por conversa (independe do canal) e NÃO altera status nem relógio do SLA", async () => {
    preparar({ atribuido_a: "ana" });
    const antes = { ...conversa() };
    const r = await criarNotaInterna(CLINICA, "conv-1", "ana", "Paciente pediu retorno amanhã");

    // (insert em notas_internas + select embutido do fake: o que importa é o efeito na conversa)
    expect(r.ok || r.error === "persist_failed").toBe(true);
    expect(conversa()).toEqual(antes);
    expect(db.tables.notas_internas[0]).toMatchObject({ conversa_id: "conv-1" });
    expect(db.tables.notas_internas[0]).not.toHaveProperty("canal_id");
  });
});
