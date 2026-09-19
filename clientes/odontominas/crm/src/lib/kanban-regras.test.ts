import { describe, expect, it } from "vitest";
import { PERFIS_PADRAO, type Perfil } from "@/lib/permissoes";
import type { StatusSlaConversa } from "@/lib/sla";
import {
  combinaBusca,
  eventoAuditoriaMovimento,
  filtrarCards,
  montarPayloadEstagioAlterado,
  podeMoverCard,
  podeVerCard,
  slaParaKanban,
  statusHttpKanban,
  tempoNoEstagioMs,
  type CardKanban,
} from "@/lib/kanban-regras";

function ator(perfil: Perfil, id = "u1") {
  return { atendenteId: id, perfil, permissoes: PERFIS_PADRAO[perfil] };
}

function card(p: Partial<CardKanban> = {}): CardKanban {
  return {
    id: "o1",
    pacienteId: "p1",
    pacienteNome: "Maria Silva",
    telefone: "5561999990001",
    interesse: "Implante",
    estagioId: "e1",
    status: "open",
    versao: 1,
    responsavelId: null,
    responsavelNome: null,
    conversaId: "c1",
    canalId: "canal-a",
    canalNome: "WhatsApp Recepção",
    origem: "instagram",
    campanhaId: null,
    etiquetas: [],
    sla: null,
    statusConversa: "novo",
    naoLidas: 0,
    ultimaInteracaoEm: null,
    estagioEntrouEm: "2026-09-18T10:00:00.000Z",
    criadoEm: "2026-09-18T10:00:00.000Z",
    motivoPerda: null,
    ...p,
  };
}

describe("RBAC do Kanban (visão e movimento)", () => {
  it("Dona e Gerente veem e movem qualquer card", () => {
    for (const perfil of ["dona", "gerente"] as const) {
      expect(podeVerCard(ator(perfil), "outra")).toBe(true);
      expect(podeMoverCard(ator(perfil), "outra")).toBe(true);
    }
  });

  it("Supervisora vê todos mas NÃO move (catálogo: só kanban.visualizar)", () => {
    expect(podeVerCard(ator("supervisora"), "outra")).toBe(true);
    expect(podeMoverCard(ator("supervisora"), "outra")).toBe(false);
  });

  it("Atendente vê/move os próprios e os sem responsável, não os de outra pessoa", () => {
    const a = ator("atendente", "ana");
    expect(podeVerCard(a, "ana")).toBe(true);
    expect(podeVerCard(a, null)).toBe(true);
    expect(podeVerCard(a, "bia")).toBe(false);
    expect(podeMoverCard(a, "ana")).toBe(true);
    expect(podeMoverCard(a, null)).toBe(true);
    expect(podeMoverCard(a, "bia")).toBe(false);
  });

  it("sem kanban.mover (customizado) → nunca move, mesmo sendo o card próprio", () => {
    const sem = { atendenteId: "ana", perfil: "atendente" as Perfil, permissoes: new Set([...PERFIS_PADRAO.atendente].filter((p) => p !== "kanban.mover")) };
    expect(podeVerCard(sem, "ana")).toBe(true);
    expect(podeMoverCard(sem, "ana")).toBe(false);
  });

  it("sem kanban.visualizar → não vê nada", () => {
    expect(podeVerCard(ator("noryos_suporte"), null)).toBe(false);
  });
});

describe("SLA: só traduz o serviço existente", () => {
  it("mapeia os 5 estados; sem_ciclo/ausente = nada no card", () => {
    const base = { cicloTipo: "primeira_resposta", cicloMensagemId: "m", cicloInicioEm: "x", limiteMinutos: 15, minutosConsumidos: 5, percentual: 33 } as const;
    for (const t of ["ok", "warning", "breached", "paused"] as const) {
      expect(slaParaKanban({ tipo: t, ...base } as StatusSlaConversa)).toBe(t);
    }
    expect(slaParaKanban({ tipo: "not_configured" })).toBe("not_configured");
    expect(slaParaKanban({ tipo: "sem_ciclo" })).toBeNull();
    expect(slaParaKanban(undefined)).toBeNull();
  });
});

describe("filtros e busca", () => {
  const cards = [
    card({ id: "a", pacienteNome: "Maria Silva", interesse: "Implante", responsavelId: "ana", etiquetas: [{ id: "t1", nome: "Urgente", cor: "#f00" }], sla: "breached" }),
    card({ id: "b", pacienteNome: "João Souza", telefone: "5561988887777", interesse: "Clareamento", canalId: "canal-b", origem: "google", criadoEm: "2026-08-01T00:00:00.000Z" }),
    card({ id: "c", pacienteNome: "Ana", interesse: null, estagioId: "e2", etiquetas: [{ id: "t1", nome: "Urgente", cor: "#f00" }, { id: "t2", nome: "VIP", cor: "#0f0" }] }),
  ];
  const ids = (f: Parameters<typeof filtrarCards>[1]) => filtrarCards(cards, f).map((c) => c.id);

  it("busca por nome (sem acento), telefone e interesse", () => {
    expect(ids({ busca: "joao" })).toEqual(["b"]);
    expect(ids({ busca: "88887777" })).toEqual(["b"]);
    expect(ids({ busca: "implante" })).toEqual(["a"]);
    expect(combinaBusca(cards[0], "12")).toBe(false);
  });

  it("responsável (incluindo 'sem'), canal, origem, sla, estágio", () => {
    expect(ids({ responsavelId: "ana" })).toEqual(["a"]);
    expect(ids({ responsavelId: "sem" })).toEqual(["b", "c"]);
    expect(ids({ canalId: "canal-b" })).toEqual(["b"]);
    expect(ids({ origem: "Google" })).toEqual(["b"]);
    expect(ids({ sla: "breached" })).toEqual(["a"]);
    expect(ids({ estagioId: "e2" })).toEqual(["c"]);
  });

  it("tags: exige TODAS as selecionadas e não altera o estágio", () => {
    expect(ids({ etiquetaIds: ["t1"] })).toEqual(["a", "c"]);
    expect(ids({ etiquetaIds: ["t1", "t2"] })).toEqual(["c"]);
    expect(filtrarCards(cards, { etiquetaIds: ["t1"] }).map((c) => c.estagioId)).toEqual(["e1", "e2"]);
  });

  it("período pelo criado_em", () => {
    expect(ids({ de: "2026-09-01T00:00:00.000Z" })).toEqual(["a", "c"]);
    expect(ids({ ate: "2026-08-31T00:00:00.000Z" })).toEqual(["b"]);
  });
});

describe("tempo no estágio, evento e auditoria", () => {
  it("deriva de estagio_entrou_em", () => {
    expect(tempoNoEstagioMs("2026-09-18T10:00:00.000Z", new Date("2026-09-18T13:00:00.000Z"))).toBe(3 * 3600_000);
  });

  it("payload do evento tem todos os campos combinados", () => {
    const p = montarPayloadEstagioAlterado({
      clinicaId: "cl", oportunidadeId: "o", pacienteId: "p", pipelineId: "pl", estagioDe: "e1", estagioPara: "e2",
      atorId: "u", ocorreuEm: new Date("2026-09-18T10:00:00.000Z"), origem: "manual",
    });
    expect(p).toEqual({
      clinica_id: "cl", oportunidade_id: "o", paciente_id: "p", pipeline_id: "pl", stage_from: "e1", stage_to: "e2",
      actor_id: "u", occurred_at: "2026-09-18T10:00:00.000Z", origem: "manual",
    });
  });

  it("auditoria por tipo de destino (won/lost têm evento próprio)", () => {
    expect(eventoAuditoriaMovimento("open")).toBe("OPPORTUNITY_STAGE_CHANGED");
    expect(eventoAuditoriaMovimento("won")).toBe("OPPORTUNITY_WON");
    expect(eventoAuditoriaMovimento("lost")).toBe("OPPORTUNITY_LOST");
  });

  it("erros → HTTP (409 conflito, 403, 400)", () => {
    expect(statusHttpKanban("conflito")).toBe(409);
    expect(statusHttpKanban("ja_existe_aberta")).toBe(409);
    expect(statusHttpKanban("forbidden")).toBe(403);
    expect(statusHttpKanban("not_found")).toBe(404);
    expect(statusHttpKanban("motivo_obrigatorio")).toBe(400);
    expect(statusHttpKanban("rpc_failed")).toBe(503);
  });
});
