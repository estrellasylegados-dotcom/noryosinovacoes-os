import { describe, expect, it } from "vitest";
import { PERFIS_PADRAO, type Perfil } from "@/lib/permissoes";
import {
  avaliarAcaoHumana,
  chaves,
  destinoDoAlerta,
  escopoEquipe,
  podeVerAlerta,
  podeVerTipo,
  rankSeveridade,
  tiposVisiveis,
  TODOS_OS_TIPOS,
  transicaoValida,
  type AtorAlerta,
} from "@/lib/alertas-tipos";

function ator(perfil: Perfil, id = "u-1"): AtorAlerta {
  return { atendenteId: id, permissoes: PERFIS_PADRAO[perfil] };
}

describe("severidade", () => {
  it("informativo < atenção < crítico", () => {
    expect(rankSeveridade("informativo")).toBeLessThan(rankSeveridade("atencao"));
    expect(rankSeveridade("atencao")).toBeLessThan(rankSeveridade("critico"));
  });
});

describe("transições válidas", () => {
  it("aberto → assumido → resolvido; aberto → resolvido; aberto/assumido → ignorado", () => {
    expect(transicaoValida("aberto", "assumir")).toBe(true);
    expect(transicaoValida("assumido", "resolver")).toBe(true);
    expect(transicaoValida("aberto", "resolver")).toBe(true);
    expect(transicaoValida("aberto", "ignorar")).toBe(true);
    expect(transicaoValida("assumido", "ignorar")).toBe(true);
  });

  it("nunca incoerentes: reassumir, e qualquer ação sobre resolvido/ignorado", () => {
    expect(transicaoValida("assumido", "assumir")).toBe(false);
    for (const acao of ["assumir", "resolver", "ignorar"] as const) {
      expect(transicaoValida("resolvido", acao)).toBe(false);
      expect(transicaoValida("ignorado", acao)).toBe(false);
    }
  });
});

describe("chaves de deduplicação", () => {
  it("SLA: conversa + ciclo; sem responsável: conversa + ciclo; kanban: oportunidade + etapa + regra; canal: canal", () => {
    expect(chaves.sla("c1", "m1")).toBe("sla:c1:m1");
    expect(chaves.sla("c1", "m1")).not.toBe(chaves.sla("c1", "m2"));
    expect(chaves.semResponsavel("c1", "m1")).toBe("sem_resp:c1:m1");
    expect(chaves.oportunidadeParada("o1", "e1", "r1")).toBe("kanban_parada:o1:e1:r1");
    expect(chaves.canal("k1")).toBe("canal:k1");
  });
});

describe("visibilidade por perfil (mesmas permissões do catálogo)", () => {
  it("atendente: SLA/sem responsável/Kanban só os próprios + fila; nunca canal, fluxo, técnico", () => {
    const a = ator("atendente");
    expect(escopoEquipe(a)).toBe(false);
    expect(tiposVisiveis(a).sort()).toEqual(["conversa_sem_responsavel", "oportunidade_parada", "sla_limite"]);
    expect(podeVerAlerta(a, { tipo: "sla_limite", responsavelId: "u-1" })).toBe(true);
    expect(podeVerAlerta(a, { tipo: "sla_limite", responsavelId: null })).toBe(true);
    expect(podeVerAlerta(a, { tipo: "sla_limite", responsavelId: "outra" })).toBe(false);
    expect(podeVerTipo(a, "canal_desconectado")).toBe(false);
    expect(podeVerTipo(a, "fluxo_preso")).toBe(false);
  });

  it("supervisora e gerente: equipe inteira; gerente vê canal, supervisora também (canais.visualizar)", () => {
    for (const perfil of ["supervisora", "gerente"] as const) {
      const a = ator(perfil);
      expect(escopoEquipe(a)).toBe(true);
      expect(podeVerAlerta(a, { tipo: "sla_limite", responsavelId: "outra" })).toBe(true);
      expect(podeVerTipo(a, "canal_desconectado")).toBe(true);
    }
  });

  it("dona: tudo da clínica exceto técnico; suporte: canal + técnico, sem alertas de conversa", () => {
    const dona = ator("dona");
    expect(podeVerTipo(dona, "fluxo_falhou")).toBe(true);
    expect(podeVerTipo(dona, "fluxo_preso")).toBe(false);

    const suporte = ator("noryos_suporte");
    expect(podeVerTipo(suporte, "fluxo_preso")).toBe(true);
    expect(podeVerTipo(suporte, "canal_desconectado")).toBe(true);
    expect(podeVerTipo(suporte, "sla_limite")).toBe(false);
  });

  it("noryos_admin vê todos os tipos; quem não tem alertas.visualizar não vê nada", () => {
    expect(tiposVisiveis(ator("noryos_admin"))).toHaveLength(TODOS_OS_TIPOS.length);
    expect(tiposVisiveis({ atendenteId: "x", permissoes: new Set(["canais.visualizar"]) })).toEqual([]);
  });
});

describe("ação humana (backend)", () => {
  const sla = { tipo: "sla_limite", responsavelId: "u-1", status: "aberto" as const };

  it("atendente resolve o próprio, mas não ignora (sem alertas.ignorar)", () => {
    expect(avaliarAcaoHumana(ator("atendente"), sla, "resolver")).toEqual({ ok: true });
    expect(avaliarAcaoHumana(ator("atendente"), sla, "ignorar")).toEqual({ ok: false, error: "forbidden" });
  });

  it("atendente não resolve alerta técnico: nem sabe que existe (not_found)", () => {
    expect(avaliarAcaoHumana(ator("atendente"), { tipo: "fluxo_preso", responsavelId: null }, "resolver")).toEqual({ ok: false, error: "not_found" });
  });

  it("alerta de outra pessoa: atendente não vê (not_found); gerente age", () => {
    const deOutra = { tipo: "sla_limite", responsavelId: "outra", status: "aberto" as const };
    expect(avaliarAcaoHumana(ator("atendente"), deOutra, "assumir")).toEqual({ ok: false, error: "not_found" });
    expect(avaliarAcaoHumana(ator("gerente"), deOutra, "assumir")).toEqual({ ok: true });
  });

  it("suporte opera técnico (assumir/resolver) mas não ignora", () => {
    const tecnico = { tipo: "fluxo_preso", responsavelId: null, status: "aberto" as const };
    expect(avaliarAcaoHumana(ator("noryos_suporte"), tecnico, "resolver")).toEqual({ ok: true });
    expect(avaliarAcaoHumana(ator("noryos_suporte"), tecnico, "ignorar")).toEqual({ ok: false, error: "forbidden" });
  });

  it("alerta assumido por outra pessoa: atendente não passa por cima; supervisão passa", () => {
    const assumido = { tipo: "sla_limite", responsavelId: null, status: "assumido" as const, assumidoPor: "outra" };
    expect(avaliarAcaoHumana(ator("atendente"), assumido, "resolver")).toEqual({ ok: false, error: "forbidden" });
    expect(avaliarAcaoHumana(ator("supervisora"), assumido, "resolver")).toEqual({ ok: true });
  });
});

describe("ação direta (destino do clique)", () => {
  it("conversa → Chat; oportunidade → Kanban + card; canal → Configurações → Canais; fluxo → editor; disparo", () => {
    expect(destinoDoAlerta({ tipoEntidade: "conversa", entidadeId: "c1", dados: {} })?.href).toBe("/chat?conversa=c1");
    expect(destinoDoAlerta({ tipoEntidade: "oportunidade", entidadeId: "o1", dados: {} })?.href).toBe("/kanban?card=o1");
    expect(destinoDoAlerta({ tipoEntidade: "canal", entidadeId: "k1", dados: {} })?.href).toBe("/configuracoes/canais?canal=k1");
    expect(destinoDoAlerta({ tipoEntidade: "fluxo_execucao", entidadeId: "e1", dados: { fluxoId: "f1" } })?.href).toBe("/fluxos/f1/editar");
    expect(destinoDoAlerta({ tipoEntidade: "disparo", entidadeId: "d1", dados: {} })?.href).toBe("/disparos/d1");
    expect(destinoDoAlerta({ tipoEntidade: "conversa", entidadeId: null, dados: {} })).toBeNull();
  });
});
