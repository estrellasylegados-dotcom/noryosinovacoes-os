/* eslint-disable @typescript-eslint/no-unused-vars -- stubs de teste ignoram argumentos de propósito */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarFakeDb, type FakeDb } from "@/lib/fake-supabase.testutil";
import { PERFIS_PADRAO, type Perfil } from "@/lib/permissoes";

let db: FakeDb;
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => db.client }));

const emitir = vi.fn(async (..._a: unknown[]) => ({ resultado: "fluxo_nao_encontrado" }));
vi.mock("@/lib/fluxo-eventos-internos", () => ({ emitirEventoAutomacao: (...a: unknown[]) => emitir(...a) }));
vi.mock("@/lib/atendentes", () => ({ buscarAtendenteCompletoPorId: vi.fn(async () => null) }));
vi.mock("@/lib/sla", () => ({ buscarStatusSlaLista: vi.fn(async () => []) }));

import { criarOportunidadeManual, garantirOportunidadeDaConversa, moverOportunidade, moverParaTipo, sincronizarResponsavelDaConversa } from "@/lib/kanban";

const CLINICA = "clinica-1";
const OUTRA = "clinica-2";

function ator(perfil: Perfil, id: string) {
  return { atendenteId: id, perfil, permissoes: PERFIS_PADRAO[perfil] };
}

/** Modelo em memória do que a função Postgres mover_oportunidade garante (a atomicidade real é provada em scripts/e2e-kanban.mjs contra o banco). */
function instalarRpcMover() {
  db.rpcHandlers.mover_oportunidade = (a) => {
    const opp = db.tables.oportunidades.find((o) => o.id === a.p_oportunidade && o.clinica_id === a.p_clinica);
    if (!opp) return { ok: false, error: "not_found" };
    const hist = db.tables.oportunidade_historico ?? (db.tables.oportunidade_historico = []);
    if (a.p_idem_key && hist.some((h) => h.oportunidade_id === opp.id && h.idempotency_key === a.p_idem_key)) {
      return { ok: true, idempotente: true, versao: opp.versao, estagio_id: opp.estagio_id, status: opp.status };
    }
    const dest = db.tables.pipeline_estagios.find((e) => e.id === a.p_estagio && e.pipeline_id === opp.pipeline_id);
    if (!dest) return { ok: false, error: "estagio_invalido" };
    if (dest.tipo === "lost" && !a.p_motivo_perda) return { ok: false, error: "motivo_obrigatorio" };
    if (opp.versao !== a.p_versao_esperada) return { ok: false, error: "conflito", versao_atual: opp.versao, estagio_atual: opp.estagio_id };
    const de = opp.estagio_id;
    opp.estagio_id = dest.id;
    opp.status = dest.tipo;
    opp.versao = (opp.versao as number) + 1;
    const h = { id: `h-${hist.length + 1}`, oportunidade_id: opp.id, estagio_de: de, estagio_para: dest.id, idempotency_key: a.p_idem_key, motivo_perda_id: a.p_motivo_perda };
    hist.push(h);
    return { ok: true, historico_id: h.id, estagio_de: de, estagio_id: dest.id, versao: opp.versao, status: opp.status, paciente_id: opp.paciente_id, pipeline_id: opp.pipeline_id };
  };
}

beforeEach(() => {
  emitir.mockClear();
  db = criarFakeDb(
    {},
    {
      pipeline_estagios: [
        { id: "novo", clinica_id: CLINICA, pipeline_id: "pl", tipo: "open", ativo: true },
        { id: "qual", clinica_id: CLINICA, pipeline_id: "pl", tipo: "open", ativo: true },
        { id: "conv", clinica_id: CLINICA, pipeline_id: "pl", tipo: "won", ativo: true },
        { id: "perd", clinica_id: CLINICA, pipeline_id: "pl", tipo: "lost", ativo: true },
      ],
      oportunidades: [
        { id: "o1", clinica_id: CLINICA, paciente_id: "p1", pipeline_id: "pl", estagio_id: "novo", responsavel_id: null, versao: 1, status: "open" },
        { id: "o-ana", clinica_id: CLINICA, paciente_id: "p2", pipeline_id: "pl", estagio_id: "novo", responsavel_id: "ana", versao: 1, status: "open" },
        { id: "o-bia", clinica_id: CLINICA, paciente_id: "p3", pipeline_id: "pl", estagio_id: "novo", responsavel_id: "bia", versao: 1, status: "open" },
        { id: "o-outra", clinica_id: OUTRA, paciente_id: "p9", pipeline_id: "pl", estagio_id: "novo", responsavel_id: null, versao: 1, status: "open" },
      ],
    }
  );
  instalarRpcMover();
});

describe("mover: persistência + histórico + evento", () => {
  it("fluxo completo Novo → Qualificado → Convertido: cada passo persiste, grava histórico e emite o evento", async () => {
    const dona = ator("dona", "dona");
    const r1 = await moverOportunidade(CLINICA, dona, "o1", { estagioId: "qual", versaoEsperada: 1 });
    expect(r1).toMatchObject({ ok: true, versao: 2, estagioId: "qual" });
    const r3 = await moverParaTipo(CLINICA, dona, "o1", "won", { versaoEsperada: 2 });
    expect(r3).toMatchObject({ ok: true, versao: 3, status: "won", estagioId: "conv" });

    expect(db.tables.oportunidade_historico).toHaveLength(2);
    expect(emitir).toHaveBeenCalledTimes(2);
    expect(emitir.mock.calls[0][0]).toMatchObject({
      clinicaId: CLINICA,
      pacienteId: "p1",
      tipo: "kanban_stage_changed",
      referenciaId: "h-1",
      metadata: { oportunidade_id: "o1", stage_from: "novo", stage_to: "qual", actor_id: "dona", origem: "manual", pipeline_id: "pl", clinica_id: CLINICA },
    });
    expect((db.tables.auditoria_eventos ?? []).map((e) => e.evento)).toEqual(["OPPORTUNITY_STAGE_CHANGED", "OPPORTUNITY_WON"]);
  });

  it("perdido exige motivo estruturado; com motivo, grava e audita OPPORTUNITY_LOST", async () => {
    const dona = ator("dona", "dona");
    expect(await moverOportunidade(CLINICA, dona, "o1", { estagioId: "perd", versaoEsperada: 1 })).toMatchObject({ ok: false, error: "motivo_obrigatorio" });
    expect(emitir).not.toHaveBeenCalled();
    const r = await moverOportunidade(CLINICA, dona, "o1", { estagioId: "perd", versaoEsperada: 1, motivoPerdaId: "m-preco", observacao: "achou caro" });
    expect(r).toMatchObject({ ok: true, status: "lost" });
    expect(db.tables.oportunidade_historico[0]).toMatchObject({ motivo_perda_id: "m-preco" });
    expect((db.tables.auditoria_eventos ?? []).map((e) => e.evento)).toEqual(["OPPORTUNITY_LOST"]);
  });

  it("retry com a mesma idempotencyKey não duplica histórico nem evento", async () => {
    const dona = ator("dona", "dona");
    const entrada = { estagioId: "qual", versaoEsperada: 1, idempotencyKey: "req-1" };
    expect(await moverOportunidade(CLINICA, dona, "o1", entrada)).toMatchObject({ ok: true, versao: 2 });
    expect(await moverOportunidade(CLINICA, dona, "o1", entrada)).toMatchObject({ ok: true, idempotente: true, versao: 2 });
    expect(db.tables.oportunidade_historico).toHaveLength(1);
    expect(emitir).toHaveBeenCalledTimes(1);
  });
});

describe("mover: concorrência", () => {
  it("A move Novo→Qualificado; B, com versão velha, tenta Novo→Perdido: 1 vence, o outro recebe conflito (sem evento)", async () => {
    const a = ator("dona", "a");
    const b = ator("gerente", "b");
    const ra = await moverOportunidade(CLINICA, a, "o1", { estagioId: "qual", versaoEsperada: 1 });
    const rb = await moverOportunidade(CLINICA, b, "o1", { estagioId: "perd", versaoEsperada: 1, motivoPerdaId: "m" });
    expect(ra.ok).toBe(true);
    expect(rb).toMatchObject({ ok: false, error: "conflito", versaoAtual: 2, estagioAtual: "qual" });
    expect(emitir).toHaveBeenCalledTimes(1);
    expect(db.tables.oportunidades.find((o) => o.id === "o1")).toMatchObject({ estagio_id: "qual", status: "open" });
  });
});

describe("mover: RBAC e clínica (backend é a autoridade)", () => {
  it("Supervisora (sem kanban.mover) → forbidden e nada muda", async () => {
    const r = await moverOportunidade(CLINICA, ator("supervisora", "sup"), "o1", { estagioId: "qual", versaoEsperada: 1 });
    expect(r).toMatchObject({ ok: false, error: "forbidden" });
    expect(db.tables.oportunidades.find((o) => o.id === "o1")?.estagio_id).toBe("novo");
  });

  it("Atendente move o próprio card e o sem responsável; não move o de outra pessoa", async () => {
    const ana = ator("atendente", "ana");
    expect(await moverOportunidade(CLINICA, ana, "o-ana", { estagioId: "qual", versaoEsperada: 1 })).toMatchObject({ ok: true });
    expect(await moverOportunidade(CLINICA, ana, "o1", { estagioId: "qual", versaoEsperada: 1 })).toMatchObject({ ok: true });
    expect(await moverOportunidade(CLINICA, ana, "o-bia", { estagioId: "qual", versaoEsperada: 1 })).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("nunca alcança oportunidade de outra clínica (not_found)", async () => {
    const r = await moverOportunidade(CLINICA, ator("dona", "d"), "o-outra", { estagioId: "qual", versaoEsperada: 1 });
    expect(r).toMatchObject({ ok: false, error: "not_found" });
    expect(db.tables.oportunidades.find((o) => o.id === "o-outra")?.estagio_id).toBe("novo");
  });

  it("estágio de outro pipeline é recusado", async () => {
    db.tables.pipeline_estagios.push({ id: "alheio", pipeline_id: "outro", tipo: "open" });
    const r = await moverOportunidade(CLINICA, ator("dona", "d"), "o1", { estagioId: "alheio", versaoEsperada: 1 });
    expect(r).toMatchObject({ ok: false, error: "estagio_invalido" });
  });
});

describe("criação e responsável (wrappers das funções Postgres)", () => {
  it("criação automática: RPC com reabrir_ciclo = conversa nova; audita só quando criou; retry não duplica", async () => {
    const chamadas: Record<string, unknown>[] = [];
    let jaCriou = false;
    db.rpcHandlers.criar_oportunidade = (a) => {
      chamadas.push(a);
      if (jaCriou) return { ok: true, criada: false, motivo: "ja_existe_aberta" };
      jaCriou = true;
      return { ok: true, criada: true, oportunidade_id: "novo-1", estagio_id: "novo" };
    };
    await garantirOportunidadeDaConversa(CLINICA, "p1", "c1", { conversaNova: true });
    await garantirOportunidadeDaConversa(CLINICA, "p1", "c1", { conversaNova: false });
    expect(chamadas.map((c) => c.p_reabrir_ciclo)).toEqual([true, false]);
    expect(chamadas[0]).toMatchObject({ p_origem: "sistema", p_paciente: "p1", p_conversa: "c1" });
    expect((db.tables.auditoria_eventos ?? []).filter((e) => e.evento === "OPPORTUNITY_CREATED")).toHaveLength(1);
  });

  it("falha do Kanban nunca derruba o chamador (Chat independe)", async () => {
    db.rpcHandlers.criar_oportunidade = () => {
      throw new Error("banco fora");
    };
    await expect(garantirOportunidadeDaConversa(CLINICA, "p1", "c1", { conversaNova: true })).resolves.toBeUndefined();
  });

  it("criação manual exige kanban.mover e devolve ja_existe_aberta quando já há uma", async () => {
    db.rpcHandlers.criar_oportunidade = () => ({ ok: true, criada: false, motivo: "ja_existe_aberta" });
    expect(await criarOportunidadeManual(CLINICA, ator("supervisora", "s"), "p1", null)).toMatchObject({ ok: false, error: "forbidden" });
    expect(await criarOportunidadeManual(CLINICA, ator("dona", "d"), "p1", null)).toMatchObject({ ok: false, error: "ja_existe_aberta" });
  });

  it("assumir: sincroniza com de=null (só oportunidade sem responsável); transferir: de=anterior", async () => {
    const chamadas: Record<string, unknown>[] = [];
    db.rpcHandlers.sincronizar_responsavel_oportunidade = (a) => {
      chamadas.push(a);
      return 1;
    };
    await sincronizarResponsavelDaConversa(CLINICA, "c1", null, "ana", "ana");
    await sincronizarResponsavelDaConversa(CLINICA, "c1", "ana", "bia", "ana");
    expect(chamadas.map((c) => [c.p_de, c.p_para])).toEqual([[null, "ana"], ["ana", "bia"]]);
    expect((db.tables.auditoria_eventos ?? []).filter((e) => e.evento === "OPPORTUNITY_OWNER_CHANGED")).toHaveLength(2);
  });
});
