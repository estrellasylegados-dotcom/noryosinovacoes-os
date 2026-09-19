import { describe, expect, it } from "vitest";
import {
  condicaoDisparoComFalhas,
  condicaoFluxoFalhou,
  condicaoFluxoPreso,
  condicaoOportunidadeParada,
  condicoesDaConversa,
  decidirCanal,
  formatarMinutos,
  type EntradaConversa,
  type EntradaOportunidade,
} from "@/lib/alertas-detectores";
import type { StatusSlaConversa } from "@/lib/sla";

const CICLO = { mensagemId: "m1", inicioEm: "2026-09-18T12:00:00.000Z" };

function sla(tipo: "ok" | "warning" | "breached" | "paused", minutos: number): StatusSlaConversa {
  return { tipo, cicloTipo: "primeira_resposta", cicloMensagemId: "m1", cicloInicioEm: CICLO.inicioEm, limiteMinutos: 15, minutosConsumidos: minutos, percentual: Math.round((minutos / 15) * 100) };
}

function conversa(extra: Partial<EntradaConversa> = {}): EntradaConversa {
  return { conversaId: "c1", atribuidoA: "juliana", dono: "humano", ciclo: CICLO, statusSla: null, minutosSemResponsavel: 0, limiteSemResponsavelMinutos: 10, ...extra };
}

describe("SLA → alerta (reaproveita o cálculo do SLA, faixa de atenção 80%)", () => {
  it("12 min de 15 (faixa de atenção) → alerta de ATENÇÃO", () => {
    const r = condicoesDaConversa(conversa({ statusSla: sla("warning", 12) }));
    expect(r.sla).toMatchObject({ tipo: "sla_limite", severidade: "atencao", titulo: "SLA próximo do limite", responsavelId: "juliana", chave: "sla:c1:m1" });
  });

  it("dentro do limite → nenhum alerta (não é log, não é aviso)", () => {
    expect(condicoesDaConversa(conversa({ statusSla: sla("ok", 5) })).sla).toBeNull();
  });

  it("estourou → mesmo alerta, mesma chave, severidade CRÍTICA (escala, não duplica)", () => {
    const atencao = condicoesDaConversa(conversa({ statusSla: sla("warning", 13) })).sla!;
    const critico = condicoesDaConversa(conversa({ statusSla: sla("breached", 22) })).sla!;
    expect(critico.severidade).toBe("critico");
    expect(critico.chave).toBe(atencao.chave);
  });

  it("responsável do alerta = dono da conversa (Juliana); sem dono → equipe (null)", () => {
    expect(condicoesDaConversa(conversa({ statusSla: sla("breached", 20) })).sla?.responsavelId).toBe("juliana");
    expect(condicoesDaConversa(conversa({ atribuidoA: null, statusSla: sla("breached", 20) })).sla?.responsavelId).toBeNull();
  });

  it("SLA pausado (fora do expediente): suspende a chave — não cria nem resolve", () => {
    const r = condicoesDaConversa(conversa({ statusSla: sla("paused", 5) }));
    expect(r.sla).toBeNull();
    expect(r.slaSuspensoChave).toBe("sla:c1:m1");
  });

  it("SLA não configurado/desligado (statusSla null) → sem alerta de SLA", () => {
    expect(condicoesDaConversa(conversa({ statusSla: null })).sla).toBeNull();
  });

  it("sem ciclo aberto (conversa respondida) → nada", () => {
    const r = condicoesDaConversa(conversa({ ciclo: null, statusSla: sla("breached", 30) }));
    expect(r).toMatchObject({ sla: null, semResponsavel: null, slaAtivo: false });
  });
});

describe("conversa sem responsável", () => {
  it("só depois do tempo configurado (10 min): antes não alerta", () => {
    expect(condicoesDaConversa(conversa({ atribuidoA: null, minutosSemResponsavel: 9 })).semResponsavel).toBeNull();
    expect(condicoesDaConversa(conversa({ atribuidoA: null, minutosSemResponsavel: 10 })).semResponsavel).toMatchObject({ tipo: "conversa_sem_responsavel", severidade: "atencao", responsavelId: null, chave: "sem_resp:c1:m1" });
  });

  it("com responsável não alerta (atendente assumiu → condição some → resolve)", () => {
    expect(condicoesDaConversa(conversa({ atribuidoA: "juliana", minutosSemResponsavel: 60 })).semResponsavel).toBeNull();
  });

  it("conversa com Fluxo/IA no controle não é 'esquecida': não alerta", () => {
    for (const dono of ["fluxo", "agente_ia"]) {
      expect(condicoesDaConversa(conversa({ atribuidoA: null, dono, minutosSemResponsavel: 60 })).semResponsavel).toBeNull();
    }
  });

  it("SLA ESTOURADO já cobre o problema: não duplica com 'sem responsável' (mas o texto do SLA avisa que falta dono)", () => {
    const r = condicoesDaConversa(conversa({ atribuidoA: null, statusSla: sla("breached", 20), minutosSemResponsavel: 20 }));
    expect(r.sla?.severidade).toBe("critico");
    expect(r.sla?.descricao).toContain("Sem responsável");
    expect(r.semResponsavel).toBeNull();
  });

  it("SLA só em atenção + sem dono: os dois existem (condições/ações diferentes: responder × assumir)", () => {
    const r = condicoesDaConversa(conversa({ atribuidoA: null, statusSla: sla("warning", 12), minutosSemResponsavel: 12 }));
    expect(r.sla).not.toBeNull();
    expect(r.semResponsavel).not.toBeNull();
  });
});

describe("Kanban: oportunidade parada", () => {
  function opp(extra: Partial<EntradaOportunidade> = {}): EntradaOportunidade {
    return { oportunidadeId: "o1", estagioId: "e1", estagioNome: "Novo", regraId: "r1", limiteMinutos: 30, minutosNaEtapa: 45, responsavelId: "juliana", conversaId: "c1", entrouEm: "2026-09-18T12:00:00.000Z", conversaComSlaAtivo: false, ...extra };
  }

  it("passou do tempo da etapa → alerta (chave: oportunidade + etapa + regra)", () => {
    expect(condicaoOportunidadeParada(opp())).toMatchObject({ tipo: "oportunidade_parada", severidade: "atencao", chave: "kanban_parada:o1:e1:r1", responsavelId: "juliana", titulo: 'Oportunidade parada em "Novo"' });
  });

  it("dentro do tempo → nada", () => {
    expect(condicaoOportunidadeParada(opp({ minutosNaEtapa: 29 }))).toBeNull();
  });

  it("paciente esperando resposta (SLA ativo na conversa): não repete o problema", () => {
    expect(condicaoOportunidadeParada(opp({ conversaComSlaAtivo: true }))).toBeNull();
  });

  it("formata tempo em min/h/dias", () => {
    expect(formatarMinutos(45)).toBe("45 min");
    expect(formatarMinutos(180)).toBe("3 h");
    expect(formatarMinutos(4320)).toBe("3 dias");
    expect(formatarMinutos(1440)).toBe("1 dia");
  });
});

describe("Canal", () => {
  const agora = new Date("2026-09-18T12:10:00.000Z");
  const base = { ativo: true, agora, carenciaMinutos: 2 };

  it("desconectado há mais que a carência → alertar", () => {
    expect(decidirCanal({ ...base, status: "disconnected", statusDesde: new Date("2026-09-18T12:00:00.000Z") })).toBe("alertar");
    expect(decidirCanal({ ...base, status: "error", statusDesde: new Date("2026-09-18T12:00:00.000Z") })).toBe("alertar");
  });

  it("piscada (caiu há 1 min, carência 2): suspende — ninguém é acordado à toa", () => {
    expect(decidirCanal({ ...base, status: "disconnected", statusDesde: new Date("2026-09-18T12:09:00.000Z") })).toBe("suspender");
  });

  it("reconectou → ok (o alerta aberto é resolvido)", () => {
    expect(decidirCanal({ ...base, status: "connected", statusDesde: new Date("2026-09-18T11:00:00.000Z") })).toBe("ok");
  });

  it("status desconhecido (não deu pra confirmar) ≠ queda: suspende sem resolver nem criar", () => {
    expect(decidirCanal({ ...base, status: "unknown", statusDesde: null })).toBe("suspender");
  });

  it("canal pausado de propósito não alerta", () => {
    expect(decidirCanal({ ...base, ativo: false, status: "disconnected", statusDesde: new Date("2026-09-18T11:00:00.000Z") })).toBe("ok");
  });
});

describe("Fluxo e disparo: só o que exige ação humana", () => {
  const f = { execucaoId: "e1", fluxoId: "f1", conversaId: "c1", finalizadoEm: "2026-09-18T12:00:00.000Z" };

  it("execução em estado real 'failed' → alerta com link pro fluxo e a conversa", () => {
    expect(condicaoFluxoFalhou({ ...f, erro: "no_invalido" })).toMatchObject({ tipo: "fluxo_falhou", chave: "fluxo_falhou:e1", dados: { fluxoId: "f1", conversaId: "c1" } });
  });

  it("opt-out (cancelamento correto) e recovery pós-restart (a cada deploy) NÃO viram alerta", () => {
    expect(condicaoFluxoFalhou({ ...f, erro: "opt_out" })).toBeNull();
    expect(condicaoFluxoFalhou({ ...f, erro: "recovery_apos_restart" })).toBeNull();
  });

  it("execução travada vira alerta TÉCNICO (tipo de natureza técnica)", () => {
    expect(condicaoFluxoPreso({ execucaoId: "e2", fluxoId: "f1", conversaId: "c1", estado: "running", parouEm: "2026-09-18T11:40:00.000Z", minutosParado: 20 })).toMatchObject({ tipo: "fluxo_preso", chave: "fluxo_preso:e2" });
  });

  it("disparo: alerta só se houve falha do PRÓPRIO envio (queda de canal já tem alerta)", () => {
    expect(condicaoDisparoComFalhas({ disparoId: "d1", nome: "Retorno", falhasProprias: 0, enviados: 40, concluidoEm: "x" })).toBeNull();
    expect(condicaoDisparoComFalhas({ disparoId: "d1", nome: "Retorno", falhasProprias: 3, enviados: 40, concluidoEm: "x" })).toMatchObject({ tipo: "disparo_falhas", chave: "disparo_falhas:d1", severidade: "atencao" });
  });
});
