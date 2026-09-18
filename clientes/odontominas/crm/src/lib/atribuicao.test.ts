/* eslint-disable @typescript-eslint/no-unused-vars -- stubs de teste ignoram argumentos de propósito */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarFakeDb, type FakeDb } from "@/lib/fake-supabase.testutil";
import { PERFIS_PADRAO, type Perfil, type Permissao } from "@/lib/permissoes";

let db: FakeDb;
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => db.client }));

const registrarEvento = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("@/lib/auditoria", () => ({ registrarEvento: (...a: unknown[]) => registrarEvento(...a) }));

type AtendenteMock = { clinicaId: string | null; status: string; perfil: Perfil; permissoesCustomizadas: string[] | null };
const atendentes = new Map<string, AtendenteMock>();
vi.mock("@/lib/atendentes", () => ({ buscarAtendenteCompletoPorId: async (id: string) => atendentes.get(id) ?? null }));

import {
  assumirConversa,
  decidirEnvioHumano,
  desatribuirConversa,
  destinoElegivel,
  podeMexerNoResponsavel,
  transferirConversa,
  type AtorConversa,
} from "@/lib/atribuicao";

const CLINICA = "clinica-1";

function ator(id: string, perfil: Perfil, permissoes?: Permissao[]): AtorConversa {
  return { atendenteId: id, perfil, permissoes: permissoes ? new Set(permissoes) : PERFIS_PADRAO[perfil] };
}

const ana = ator("ana", "atendente");
const bia = ator("bia", "atendente");
const supervisora = ator("sup", "supervisora");
const gerente = ator("ger", "gerente");

describe("decidirEnvioHumano — quem pode RESPONDER", () => {
  it("responsável responde", () => expect(decidirEnvioHumano(ana, "ana")).toBe("responsavel"));
  it("conversa sem responsável: assume e envia (atômico)", () => expect(decidirEnvioHumano(ana, null)).toBe("assumir_e_enviar"));
  it("atendente comum NÃO responde conversa de outra pessoa", () => expect(decidirEnvioHumano(bia, "ana")).toBe("negado"));
  it("supervisora/gerente com conversas.intervir intervêm", () => {
    expect(decidirEnvioHumano(supervisora, "ana")).toBe("intervir");
    expect(decidirEnvioHumano(gerente, "ana")).toBe("intervir");
  });
  it("sem conversas.assumir nada feito (ex.: Noryos Suporte)", () => {
    const suporte = ator("sup-noryos", "noryos_suporte");
    expect(decidirEnvioHumano(suporte, null)).toBe("negado");
    expect(decidirEnvioHumano(suporte, "ana")).toBe("negado");
  });
  it("permissão customizada vale: atendente com intervir pode intervir", () => {
    expect(decidirEnvioHumano(ator("bia", "atendente", ["conversas.assumir", "conversas.intervir"]), "ana")).toBe("intervir");
  });
});

describe("podeMexerNoResponsavel — transferir / devolver à fila", () => {
  it("atendente transfere a própria conversa e a da fila, mas não a de outra", () => {
    expect(podeMexerNoResponsavel(ana, "ana")).toBe(true);
    expect(podeMexerNoResponsavel(ana, null)).toBe(true);
    expect(podeMexerNoResponsavel(ana, "bia")).toBe(false);
  });
  it("supervisora e gerente transferem qualquer conversa", () => {
    expect(podeMexerNoResponsavel(supervisora, "ana")).toBe(true);
    expect(podeMexerNoResponsavel(gerente, "ana")).toBe(true);
  });
  it("sem conversas.transferir, nunca", () => {
    expect(podeMexerNoResponsavel(ator("x", "atendente", ["conversas.assumir"]), "x")).toBe(false);
  });
});

describe("destinoElegivel", () => {
  const ok = { clinicaId: CLINICA, status: "active", perfil: "atendente" as Perfil, permissoes: PERFIS_PADRAO.atendente };
  it("ativo, mesma clínica, com conversas.assumir", () => expect(destinoElegivel(ok, CLINICA)).toBe(true));
  it("outra clínica → negado", () => expect(destinoElegivel({ ...ok, clinicaId: "outra" }, CLINICA)).toBe("destino_invalido"));
  it("desativado/pendente → negado", () => {
    expect(destinoElegivel({ ...ok, status: "disabled" }, CLINICA)).toBe("destino_invalido");
    expect(destinoElegivel({ ...ok, status: "pending" }, CLINICA)).toBe("destino_invalido");
  });
  it("conta de plataforma nunca recebe conversa", () => {
    expect(destinoElegivel({ ...ok, perfil: "noryos_admin", clinicaId: null }, CLINICA)).toBe("destino_invalido");
  });
  it("sem conversas.assumir → destino_sem_permissao", () => {
    expect(destinoElegivel({ ...ok, permissoes: new Set<Permissao>() }, CLINICA)).toBe("destino_sem_permissao");
  });
});

beforeEach(() => {
  registrarEvento.mockClear();
  atendentes.clear();
  atendentes.set("bia", { clinicaId: CLINICA, status: "active", perfil: "atendente", permissoesCustomizadas: null });
  atendentes.set("de-outra-clinica", { clinicaId: "clinica-2", status: "active", perfil: "atendente", permissoesCustomizadas: null });
  atendentes.set("desativada", { clinicaId: CLINICA, status: "disabled", perfil: "atendente", permissoesCustomizadas: null });
  db = criarFakeDb({}, { conversas: [{ id: "conv-1", clinica_id: CLINICA, canal_id: "canal-a", dono_conversa: "humano", atribuido_a: null }] });
});

describe("assumirConversa", () => {
  it("sucesso: chama a RPC atômica e audita", async () => {
    db.rpcHandlers.assumir_conversa = () => ({ ok: true });
    const r = await assumirConversa(CLINICA, "conv-1", ana);
    expect(r).toEqual({ ok: true, jaEraSua: false });
    expect(registrarEvento).toHaveBeenCalledWith(expect.objectContaining({ evento: "CONVERSATION_ASSIGNED", alvoId: "conv-1", atorId: "ana" }));
  });

  it("conflito: devolve 'ja_assumida' com QUEM assumiu, sem auditar como sucesso", async () => {
    db.rpcHandlers.assumir_conversa = () => ({ ok: false, error: "ja_assumida", por_id: "bia", por_nome: "Juliana" });
    const r = await assumirConversa(CLINICA, "conv-1", ana);
    expect(r).toEqual({ ok: false, error: "ja_assumida", porId: "bia", porNome: "Juliana" });
    expect(registrarEvento).not.toHaveBeenCalled();
  });

  it("já era minha: idempotente, sem evento duplicado", async () => {
    db.rpcHandlers.assumir_conversa = () => ({ ok: true, ja_era_sua: true });
    const r = await assumirConversa(CLINICA, "conv-1", ana);
    expect(r).toEqual({ ok: true, jaEraSua: true });
    expect(registrarEvento).not.toHaveBeenCalled();
  });

  it("sem permissão conversas.assumir → forbidden e a RPC nem é chamada", async () => {
    const chamada = vi.fn(() => ({ ok: true }));
    db.rpcHandlers.assumir_conversa = chamada;
    expect(await assumirConversa(CLINICA, "conv-1", ator("x", "noryos_suporte"))).toEqual({ ok: false, error: "forbidden" });
    expect(chamada).not.toHaveBeenCalled();
  });

  it("humano assumiu conversa que estava com a IA → a IA para (dono vira humano, agente sai)", async () => {
    Object.assign(db.tables.conversas[0], { dono_conversa: "agente_ia", agente_ativo_id: "agente-1" });
    db.rpcHandlers.assumir_conversa = () => ({ ok: true });
    await assumirConversa(CLINICA, "conv-1", ana);
    expect(db.tables.conversas[0]).toMatchObject({ dono_conversa: "humano", agente_ativo_id: null });
  });

  it("conversa com Fluxo ativo: assumir NÃO derruba o fluxo (waiting_input segue valendo)", async () => {
    Object.assign(db.tables.conversas[0], { dono_conversa: "fluxo", fluxo_execucao_ativa_id: "exec-1" });
    db.rpcHandlers.assumir_conversa = () => ({ ok: true });
    await assumirConversa(CLINICA, "conv-1", ana);
    expect(db.tables.conversas[0]).toMatchObject({ dono_conversa: "fluxo", fluxo_execucao_ativa_id: "exec-1" });
  });
});

describe("transferirConversa", () => {
  it("A → B: RPC recebe o responsável ESPERADO (detecção de concorrência) e audita", async () => {
    const rpc = vi.fn(() => ({ ok: true }));
    db.rpcHandlers.transferir_conversa = rpc;
    const r = await transferirConversa(CLINICA, "conv-1", ana, "ana", "bia", "troca de turno");
    expect(r).toEqual({ ok: true, jaEraSua: false });
    expect(rpc).toHaveBeenCalledWith(expect.objectContaining({ p_esperado: "ana", p_destino: "bia", p_forcar: false, p_motivo: "troca de turno" }));
    expect(registrarEvento).toHaveBeenCalledWith(expect.objectContaining({ evento: "CONVERSATION_TRANSFERRED" }));
  });

  it("destino de OUTRA clínica → NEGADO, RPC nem é chamada", async () => {
    const rpc = vi.fn(() => ({ ok: true }));
    db.rpcHandlers.transferir_conversa = rpc;
    expect(await transferirConversa(CLINICA, "conv-1", ana, "ana", "de-outra-clinica", null)).toEqual({ ok: false, error: "destino_invalido" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("destino DESATIVADO ou inexistente → NEGADO", async () => {
    expect(await transferirConversa(CLINICA, "conv-1", ana, "ana", "desativada", null)).toEqual({ ok: false, error: "destino_invalido" });
    expect(await transferirConversa(CLINICA, "conv-1", ana, "ana", "fantasma", null)).toEqual({ ok: false, error: "destino_invalido" });
  });

  it("atendente comum não transfere conversa de outra pessoa", async () => {
    expect(await transferirConversa(CLINICA, "conv-1", bia, "ana", "bia", null)).toEqual({ ok: false, error: "forbidden" });
  });

  it("transferência concorrente: quem chega depois recebe conflito com o estado atual", async () => {
    db.rpcHandlers.transferir_conversa = () => ({ ok: false, error: "conflito", por_id: "carla", por_nome: "Carla" });
    const r = await transferirConversa(CLINICA, "conv-1", supervisora, "ana", "bia", null);
    expect(r).toEqual({ ok: false, error: "conflito", porId: "carla", porNome: "Carla" });
    expect(registrarEvento).not.toHaveBeenCalled();
  });

  it("da fila (esperado null) para alguém = atribuição, auditada como ASSIGNED", async () => {
    db.rpcHandlers.transferir_conversa = () => ({ ok: true });
    await transferirConversa(CLINICA, "conv-1", supervisora, null, "bia", null);
    expect(registrarEvento).toHaveBeenCalledWith(expect.objectContaining({ evento: "CONVERSATION_ASSIGNED" }));
  });
});

describe("desatribuirConversa", () => {
  it("devolve à fila e audita", async () => {
    db.rpcHandlers.desatribuir_conversa = () => ({ ok: true });
    expect(await desatribuirConversa(CLINICA, "conv-1", ana, "ana")).toEqual({ ok: true, jaEraSua: false });
    expect(registrarEvento).toHaveBeenCalledWith(expect.objectContaining({ evento: "CONVERSATION_UNASSIGNED" }));
  });
  it("conversa sem responsável não tem o que devolver", async () => {
    expect(await desatribuirConversa(CLINICA, "conv-1", ana, null)).toEqual({ ok: false, error: "conflito" });
  });
  it("atendente comum não devolve a conversa de outra pessoa", async () => {
    expect(await desatribuirConversa(CLINICA, "conv-1", bia, "ana")).toEqual({ ok: false, error: "forbidden" });
  });
});
