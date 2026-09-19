/* eslint-disable @typescript-eslint/no-unused-vars -- stubs de teste ignoram argumentos de propósito */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarFakeDb, type FakeDb } from "@/lib/fake-supabase.testutil";
import { PERFIS_PADRAO, type Perfil } from "@/lib/permissoes";
import type { Condicao } from "@/lib/alertas-tipos";

let db: FakeDb;
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => db.client }));
const registrarEvento = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("@/lib/auditoria", () => ({ registrarEvento: (...a: unknown[]) => registrarEvento(...a) }));

import { abrirAlertaPorEvento, aplicarCondicao, executarAcaoAlerta, mapearAlerta, resolverPorEvento, sincronizarAlertas } from "@/lib/alertas";

const CLINICA = "clinica-1";
const OUTRA_CLINICA = "clinica-2";

function cond(extra: Partial<Condicao> = {}): Condicao {
  return {
    tipo: "sla_limite",
    chave: "sla:conv-1:msg-1",
    severidade: "atencao",
    titulo: "SLA próximo do limite",
    tipoEntidade: "conversa",
    entidadeId: "conv-1",
    responsavelId: null,
    dados: { limiteMinutos: 15 },
    ...extra,
  };
}

const alertas = () => db.tables.alertas ?? [];
const historico = () => (db.tables.alerta_historico ?? []).map((h) => h.evento);

beforeEach(() => {
  registrarEvento.mockClear();
  db = criarFakeDb(
    { alertas: [["clinica_id", "chave_ativa"]] },
    {},
    { alertas: { status: "aberto", natureza: "operacional", dados: {}, detectado_em: "2026-09-18T12:00:00.000Z" } }
  );
});

describe("criação e deduplicação", () => {
  it("cria 1 alerta aberto com histórico 'criado'", async () => {
    const r = await aplicarCondicao(CLINICA, cond());
    expect(r.resultado).toBe("criado");
    expect(alertas()).toHaveLength(1);
    expect(alertas()[0]).toMatchObject({ clinica_id: CLINICA, tipo: "sla_limite", categoria: "SLA", severidade: "atencao", status: "aberto", chave_ativa: "sla:conv-1:msg-1" });
    expect(historico()).toEqual(["criado"]);
  });

  it("mesma condição reavaliada N vezes = 1 alerta (idempotente)", async () => {
    for (let i = 0; i < 5; i++) await aplicarCondicao(CLINICA, cond());
    expect(alertas()).toHaveLength(1);
    expect(historico()).toEqual(["criado"]);
  });

  it("dois processos criando a MESMA condição ao mesmo tempo → 1 registro (unicidade, não checagem em memória)", async () => {
    // existente=null força os dois a tentarem INSERT — o segundo bate no índice único e é tratado como deduplicado.
    const [a, b] = await Promise.all([aplicarCondicao(CLINICA, cond(), null), aplicarCondicao(CLINICA, cond(), null)]);
    expect([a.resultado, b.resultado].sort()).toEqual(["criado", "deduplicado"]);
    expect(alertas()).toHaveLength(1);
  });

  it("condições diferentes convivem", async () => {
    await aplicarCondicao(CLINICA, cond());
    await aplicarCondicao(CLINICA, cond({ chave: "sla:conv-2:msg-9", entidadeId: "conv-2" }));
    expect(alertas()).toHaveLength(2);
  });
});

describe("severidade", () => {
  it("atenção → crítico atualiza o MESMO alerta e preserva histórico", async () => {
    await aplicarCondicao(CLINICA, cond());
    const r = await aplicarCondicao(CLINICA, cond({ severidade: "critico", titulo: "SLA estourado" }));
    expect(r.resultado).toBe("escalado");
    expect(alertas()).toHaveLength(1);
    expect(alertas()[0]).toMatchObject({ severidade: "critico", titulo: "SLA estourado" });
    expect(historico()).toEqual(["criado", "severidade_alterada"]);
  });

  it("nunca rebaixa: condição mais branda não altera um crítico", async () => {
    await aplicarCondicao(CLINICA, cond({ severidade: "critico" }));
    const r = await aplicarCondicao(CLINICA, cond({ severidade: "atencao" }));
    expect(r.resultado).toBe("deduplicado");
    expect(alertas()[0].severidade).toBe("critico");
  });

  it("ignorar 'atenção' não esconde o 'crítico' da mesma ocorrência: piora reabre", async () => {
    await aplicarCondicao(CLINICA, cond());
    alertas()[0].status = "ignorado";
    const r = await aplicarCondicao(CLINICA, cond({ severidade: "critico" }));
    expect(r.resultado).toBe("reaberto");
    expect(alertas()[0]).toMatchObject({ status: "aberto", severidade: "critico" });
    expect(historico()).toContain("reaberto");
  });

  it("mudança de responsável (transferência) atualiza o alerta aberto, com histórico", async () => {
    await aplicarCondicao(CLINICA, cond({ responsavelId: "juliana" }));
    await aplicarCondicao(CLINICA, cond({ responsavelId: "maria" }));
    expect(alertas()[0].responsavel_id).toBe("maria");
    expect(historico()).toContain("responsavel_alterado");
  });
});

describe("sincronização (estado desejado × alertas vivos)", () => {
  it("condição some → resolvido automaticamente, chave liberada, evento registrado", async () => {
    await sincronizarAlertas(CLINICA, { tipos: ["sla_limite"], ativas: [cond()] });
    const r = await sincronizarAlertas(CLINICA, { tipos: ["sla_limite"], ativas: [], motivoEncerramento: "resposta_humana" });
    expect(r.resolvidos).toBe(1);
    expect(alertas()[0]).toMatchObject({ status: "resolvido", chave_ativa: null, resolvido_por_evento: "resposta_humana" });
    expect(alertas()[0].resolvido_em).toBeTruthy();
    expect(historico()).toEqual(["criado", "resolvido"]);
  });

  it("nova ocorrência: resolvida a condição, se voltar (mesma chave) nasce um alerta NOVO", async () => {
    await sincronizarAlertas(CLINICA, { tipos: ["canal_desconectado"], ativas: [cond({ tipo: "canal_desconectado", chave: "canal:k1", entidadeId: "k1", tipoEntidade: "canal" })] });
    await sincronizarAlertas(CLINICA, { tipos: ["canal_desconectado"], ativas: [] });
    await sincronizarAlertas(CLINICA, { tipos: ["canal_desconectado"], ativas: [cond({ tipo: "canal_desconectado", chave: "canal:k1", entidadeId: "k1", tipoEntidade: "canal" })] });
    expect(alertas()).toHaveLength(2);
    expect(alertas().filter((a) => a.status === "aberto")).toHaveLength(1);
    expect(alertas().filter((a) => a.status === "resolvido")).toHaveLength(1);
  });

  it("condição SUSPENSA (SLA pausado fora do expediente): nem cria nem resolve", async () => {
    await sincronizarAlertas(CLINICA, { tipos: ["sla_limite"], ativas: [cond()] });
    const r = await sincronizarAlertas(CLINICA, { tipos: ["sla_limite"], ativas: [], manter: ["sla:conv-1:msg-1"] });
    expect(r.resolvidos).toBe(0);
    expect(alertas()[0].status).toBe("aberto");
  });

  it("só resolve tipos que a detecção cobre: outro tipo aberto fica intacto", async () => {
    await aplicarCondicao(CLINICA, cond({ tipo: "canal_desconectado", chave: "canal:k1", entidadeId: "k1", tipoEntidade: "canal" }));
    await sincronizarAlertas(CLINICA, { tipos: ["sla_limite"], ativas: [] });
    expect(alertas()[0].status).toBe("aberto");
  });

  it("fato pontual (fluxo falhou) não se resolve por sumir da detecção — só a pessoa encerra", async () => {
    const falha = cond({ tipo: "fluxo_falhou", chave: "fluxo_falhou:e1", entidadeId: "e1", tipoEntidade: "fluxo_execucao" });
    await sincronizarAlertas(CLINICA, { tipos: ["fluxo_falhou"], ativas: [falha] });
    await sincronizarAlertas(CLINICA, { tipos: ["fluxo_falhou"], ativas: [] });
    expect(alertas()[0]).toMatchObject({ status: "aberto", chave_ativa: "fluxo_falhou:e1" });
  });

  it("resolvido/ignorado por pessoa com condição viva mantém a chave (sem reabrir no minuto seguinte); some a condição → libera", async () => {
    await sincronizarAlertas(CLINICA, { tipos: ["sla_limite"], ativas: [cond()] });
    alertas()[0].status = "ignorado";
    const viva = await sincronizarAlertas(CLINICA, { tipos: ["sla_limite"], ativas: [cond()] });
    expect(viva.criados).toBe(0);
    expect(alertas()).toHaveLength(1);

    const fim = await sincronizarAlertas(CLINICA, { tipos: ["sla_limite"], ativas: [] });
    expect(fim.liberados).toBe(1);
    expect(alertas()[0]).toMatchObject({ status: "ignorado", chave_ativa: null });
  });
});

describe("resolução por evento", () => {
  it("resposta humana resolve o SLA da conversa, registra o evento e o usuário", async () => {
    await aplicarCondicao(CLINICA, cond({ severidade: "critico" }));
    const n = await resolverPorEvento(CLINICA, { tipos: ["sla_limite"], tipoEntidade: "conversa", entidadeId: "conv-1", evento: "resposta_humana", atorId: "juliana" });
    expect(n).toBe(1);
    expect(alertas()[0]).toMatchObject({ status: "resolvido", resolvido_por_evento: "resposta_humana", resolvido_por: "juliana", chave_ativa: null });
  });

  it("não toca alerta de outra entidade nem de outra clínica", async () => {
    await aplicarCondicao(CLINICA, cond());
    await aplicarCondicao(OUTRA_CLINICA, cond());
    await resolverPorEvento(CLINICA, { tipos: ["sla_limite"], tipoEntidade: "conversa", entidadeId: "conv-OUTRA", evento: "resposta_humana" });
    expect(alertas().every((a) => a.status === "aberto")).toBe(true);
    await resolverPorEvento(CLINICA, { tipos: ["sla_limite"], tipoEntidade: "conversa", entidadeId: "conv-1", evento: "resposta_humana" });
    expect(alertas().find((a) => a.clinica_id === OUTRA_CLINICA)?.status).toBe("aberto");
  });
});

describe("detecção por evento (mensagem com falha definitiva)", () => {
  const falha = (): Condicao => ({ tipo: "mensagem_falha_definitiva", chave: "msg_falha:fluxo:e1:3", severidade: "atencao", titulo: "Mensagem automática não entregue", tipoEntidade: "conversa", entidadeId: "conv-1", responsavelId: null });

  it("cria uma vez; repetir o mesmo evento deduplica", async () => {
    await abrirAlertaPorEvento(CLINICA, falha());
    await abrirAlertaPorEvento(CLINICA, falha());
    expect(alertas()).toHaveLength(1);
    expect(alertas()[0]).toMatchObject({ categoria: "MENSAGEM", natureza: "operacional" });
  });

  it("tipo desabilitado na configuração: não cria", async () => {
    db.tables.alertas_config = [{ clinica_id: CLINICA, tipos_desabilitados: ["mensagem_falha_definitiva"] }];
    await abrirAlertaPorEvento(CLINICA, falha());
    expect(alertas()).toHaveLength(0);
  });
});

describe("ações humanas", () => {
  function ator(perfil: Perfil, id = "u-1") {
    return { atendenteId: id, perfil, permissoes: PERFIS_PADRAO[perfil] };
  }
  async function novoAlerta(extra: Partial<Condicao> = {}) {
    const r = await aplicarCondicao(CLINICA, cond(extra));
    return r.alerta!.id;
  }

  it("assumir → status assumido, quem e quando, auditoria ALERTA_ASSUMIDO", async () => {
    const id = await novoAlerta();
    const r = await executarAcaoAlerta(CLINICA, id, "assumir", ator("gerente"));
    expect(r.ok).toBe(true);
    expect(alertas()[0]).toMatchObject({ status: "assumido", assumido_por: "u-1" });
    expect(alertas()[0].assumido_em).toBeTruthy();
    expect(registrarEvento).toHaveBeenCalledWith(expect.objectContaining({ evento: "ALERTA_ASSUMIDO", alvoId: id, atorId: "u-1" }));
    expect(historico()).toContain("assumido");
  });

  it("resolver (aberto → resolvido direto) e (assumido → resolvido); auditado", async () => {
    const id = await novoAlerta();
    expect((await executarAcaoAlerta(CLINICA, id, "resolver", ator("gerente"))).ok).toBe(true);
    expect(alertas()[0]).toMatchObject({ status: "resolvido", resolvido_por: "u-1", resolvido_por_evento: "manual" });
    expect(registrarEvento).toHaveBeenCalledWith(expect.objectContaining({ evento: "ALERTA_RESOLVIDO" }));

    const id2 = await novoAlerta({ chave: "sla:conv-2:msg-2", entidadeId: "conv-2" });
    await executarAcaoAlerta(CLINICA, id2, "assumir", ator("gerente"));
    expect((await executarAcaoAlerta(CLINICA, id2, "resolver", ator("gerente"))).ok).toBe(true);
  });

  it("resolver à mão NÃO libera a chave (condição viva não reabre no minuto seguinte)", async () => {
    const id = await novoAlerta();
    await executarAcaoAlerta(CLINICA, id, "resolver", ator("gerente"));
    expect(alertas()[0].chave_ativa).toBe("sla:conv-1:msg-1");
  });

  it("ignorar guarda usuário, motivo e data; auditoria ALERTA_IGNORADO; só quem tem alertas.ignorar", async () => {
    const id = await novoAlerta();
    expect(await executarAcaoAlerta(CLINICA, id, "ignorar", ator("supervisora"))).toEqual({ ok: false, error: "forbidden" });

    const r = await executarAcaoAlerta(CLINICA, id, "ignorar", ator("gerente"), { motivo: "  paciente já ligou  " });
    expect(r.ok).toBe(true);
    expect(alertas()[0]).toMatchObject({ status: "ignorado", ignorado_por: "u-1", ignorado_motivo: "paciente já ligou" });
    expect(alertas()[0].ignorado_em).toBeTruthy();
    expect(registrarEvento).toHaveBeenCalledWith(expect.objectContaining({ evento: "ALERTA_IGNORADO", detalhes: expect.objectContaining({ motivo: "paciente já ligou" }) }));
  });

  it("transição inválida: assumir duas vezes, ou agir num resolvido → transicao_invalida (nada muda)", async () => {
    const id = await novoAlerta();
    await executarAcaoAlerta(CLINICA, id, "assumir", ator("gerente"));
    expect(await executarAcaoAlerta(CLINICA, id, "assumir", ator("gerente", "u-2"))).toEqual({ ok: false, error: "transicao_invalida" });
    await executarAcaoAlerta(CLINICA, id, "resolver", ator("gerente"));
    expect(await executarAcaoAlerta(CLINICA, id, "ignorar", ator("gerente"))).toEqual({ ok: false, error: "transicao_invalida" });
    expect(alertas()[0].status).toBe("resolvido");
  });

  it("duas pessoas assumindo ao mesmo tempo: só uma vence (compare-and-set)", async () => {
    const id = await novoAlerta();
    const [a, b] = await Promise.all([executarAcaoAlerta(CLINICA, id, "assumir", ator("gerente", "u-1")), executarAcaoAlerta(CLINICA, id, "assumir", ator("gerente", "u-2"))]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
  });

  it("outra clínica: not_found, nunca forbidden (não vaza existência) e nada é alterado", async () => {
    const id = await novoAlerta();
    expect(await executarAcaoAlerta(OUTRA_CLINICA, id, "resolver", ator("dona"))).toEqual({ ok: false, error: "not_found" });
    expect(alertas()[0].status).toBe("aberto");
  });

  it("atendente não resolve alerta técnico; suporte resolve; gerente da clínica não vê o técnico", async () => {
    const id = await novoAlerta({ tipo: "fluxo_preso", chave: "fluxo_preso:e1", entidadeId: "e1", tipoEntidade: "fluxo_execucao" });
    expect(await executarAcaoAlerta(CLINICA, id, "resolver", ator("atendente"))).toEqual({ ok: false, error: "not_found" });
    expect(await executarAcaoAlerta(CLINICA, id, "resolver", ator("gerente"))).toEqual({ ok: false, error: "not_found" });
    expect((await executarAcaoAlerta(CLINICA, id, "resolver", ator("noryos_suporte"))).ok).toBe(true);
    expect(alertas()[0].natureza).toBe("tecnico");
  });

  it("alerta inexistente → not_found; motivo gigante → rejeitado", async () => {
    expect(await executarAcaoAlerta(CLINICA, "nao-existe", "resolver", ator("dona"))).toEqual({ ok: false, error: "not_found" });
    const id = await novoAlerta();
    expect(await executarAcaoAlerta(CLINICA, id, "ignorar", ator("dona"), { motivo: "x".repeat(301) })).toEqual({ ok: false, error: "motivo_muito_longo" });
  });
});

describe("mapeamento", () => {
  it("linha do banco → AlertaLinha", () => {
    const a = mapearAlerta({ id: "1", clinica_id: CLINICA, tipo: "sla_limite", categoria: "SLA", natureza: "operacional", severidade: "critico", status: "aberto", titulo: "t", chave_deduplicacao: "k", chave_ativa: "k", detectado_em: "2026-09-18T12:00:00Z", dados: { a: 1 } });
    expect(a).toMatchObject({ id: "1", severidade: "critico", chaveAtiva: "k", dados: { a: 1 }, responsavelId: null });
  });
});
