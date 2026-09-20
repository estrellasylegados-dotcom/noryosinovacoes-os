import { describe, expect, it } from "vitest";
import { agendamentoComercial, chaveComercial, combinaEventoComercial, lerConfigComercial, type EventoKanban } from "@/lib/fluxo-comercial-regras";

const evento: EventoKanban = {
  id: "evento-1", clinica_id: "clinica-1", oportunidade_id: "oportunidade-1", paciente_id: "paciente-1",
  pipeline_id: "pipeline-1", stage_from: "novo", stage_to: "follow-up", status: "open",
  occurred_at: "2026-09-20T12:00:00.000Z", entrada_em: "2026-09-20T12:00:00.000Z",
  conversa_id: "conversa-1", responsavel_id: null, origem: "manual", cadeia: [],
};
const base = {
  pipelineId: "pipeline-1", etapaId: "follow-up", modo: "entrada" as const, tempoSegundos: 0,
  reentrada: "por_entrada" as const, pararAoSair: true, pararAoResponder: true,
  respeitarHorario: true, aceitarOrigemAutomacao: false,
};

describe("regras de automação comercial", () => {
  it("aceita entrada na etapa configurada", () => {
    expect(combinaEventoComercial(base, evento, "fluxo-1")).toBe(true);
  });
  it("aceita saída, conversão e perda pelos respectivos modos", () => {
    expect(combinaEventoComercial({ ...base, etapaId: "novo", modo: "saida" }, evento, "fluxo-1")).toBe(true);
    expect(combinaEventoComercial({ ...base, etapaId: "", modo: "convertida" }, { ...evento, status: "won" }, "fluxo-1")).toBe(true);
    expect(combinaEventoComercial({ ...base, etapaId: "", modo: "perdida" }, { ...evento, status: "lost" }, "fluxo-1")).toBe(true);
  });
  it("bloqueia origem automática por padrão e ciclos na cadeia", () => {
    expect(combinaEventoComercial(base, { ...evento, origem: "automacao" }, "fluxo-1")).toBe(false);
    expect(combinaEventoComercial({ ...base, aceitarOrigemAutomacao: true }, { ...evento, origem: "automacao", cadeia: ["fluxo-1"] }, "fluxo-1")).toBe(false);
    expect(combinaEventoComercial({ ...base, aceitarOrigemAutomacao: true }, { ...evento, origem: "automacao", cadeia: Array.from({ length: 10 }, (_, i) => `f-${i}`) }, "fluxo-1")).toBe(false);
  });
  it("mantém dedupe conforme a política de reentrada", () => {
    expect(chaveComercial({ ...base, reentrada: "uma_vez" }, evento)).toBe("oportunidade:oportunidade-1");
    expect(chaveComercial(base, evento)).toBe("kanban:oportunidade-1:evento-1");
  });
  it("agenda permanência a partir da entrada real na etapa", () => {
    expect(agendamentoComercial({ ...base, modo: "permanencia", tempoSegundos: 900 }, evento)).toBe("2026-09-20T12:15:00.000Z");
  });
  it("rejeita configuração incompleta e permanência sem tempo", () => {
    expect(lerConfigComercial({ ...base, pipelineId: "" })).toBeNull();
    expect(lerConfigComercial({ ...base, modo: "permanencia", tempoSegundos: 0 })).toBeNull();
  });
});
