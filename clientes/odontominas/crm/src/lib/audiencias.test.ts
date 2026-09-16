import { describe, expect, it } from "vitest";
import { resolverPublico, type CandidatoAudiencia, type FiltroAudiencia } from "@/lib/audiencias";

const dia = (n: number) => n * 24 * 60 * 60 * 1000;
const AGORA = new Date("2026-09-16T12:00:00Z").getTime();
const iso = (msAtras: number) => new Date(AGORA - msAtras).toISOString();

function candidato(overrides: Partial<CandidatoAudiencia>): CandidatoAudiencia {
  return {
    pacienteId: "p1",
    conversaId: "c1",
    telefone: "5561999999999",
    nome: "Maria Silva",
    statusConversa: "respondido",
    ultimaMensagemEm: iso(dia(90)),
    etiquetaIds: [],
    optOutEm: null,
    ...overrides,
  };
}

describe("resolverPublico — inatividade", () => {
  it("bate quando está inativo há mais que o pedido", () => {
    const filtro: FiltroAudiencia = { inativoHaDias: 60 };
    const resultado = resolverPublico([candidato({ ultimaMensagemEm: iso(dia(90)) })], filtro, AGORA);
    expect(resultado.totalEncontrados).toBe(1);
    expect(resultado.elegiveis.map((c) => c.pacienteId)).toEqual(["p1"]);
  });

  it("não bate quando está inativo há menos que o pedido", () => {
    const filtro: FiltroAudiencia = { inativoHaDias: 60 };
    const resultado = resolverPublico([candidato({ ultimaMensagemEm: iso(dia(10)) })], filtro, AGORA);
    expect(resultado.totalEncontrados).toBe(0);
  });

  it("sem ultima_mensagem_em nunca bate em filtro de inatividade", () => {
    const filtro: FiltroAudiencia = { inativoHaDias: 60 };
    const resultado = resolverPublico([candidato({ ultimaMensagemEm: null })], filtro, AGORA);
    expect(resultado.totalEncontrados).toBe(0);
  });
});

describe("resolverPublico — status da conversa", () => {
  it("filtra por status pedido", () => {
    const filtro: FiltroAudiencia = { statusConversa: ["perdido"] };
    const candidatos = [candidato({ pacienteId: "p1", statusConversa: "perdido" }), candidato({ pacienteId: "p2", statusConversa: "agendado" })];
    const resultado = resolverPublico(candidatos, filtro, AGORA);
    expect(resultado.elegiveis.map((c) => c.pacienteId)).toEqual(["p1"]);
  });
});

describe("resolverPublico — etiqueta", () => {
  const comEtiquetaA = candidato({ pacienteId: "p1", etiquetaIds: ["a"] });
  const comEtiquetaB = candidato({ pacienteId: "p2", etiquetaIds: ["b"] });
  const comAmbas = candidato({ pacienteId: "p3", etiquetaIds: ["a", "b"] });

  it("modo 'qualquer' (padrão): basta ter 1 das etiquetas", () => {
    const filtro: FiltroAudiencia = { etiquetaIds: ["a", "b"] };
    const resultado = resolverPublico([comEtiquetaA, comEtiquetaB, comAmbas], filtro, AGORA);
    expect(resultado.elegiveis.map((c) => c.pacienteId).sort()).toEqual(["p1", "p2", "p3"]);
  });

  it("modo 'todas': precisa ter todas as etiquetas pedidas", () => {
    const filtro: FiltroAudiencia = { etiquetaIds: ["a", "b"], etiquetaModo: "todas" };
    const resultado = resolverPublico([comEtiquetaA, comEtiquetaB, comAmbas], filtro, AGORA);
    expect(resultado.elegiveis.map((c) => c.pacienteId)).toEqual(["p3"]);
  });
});

describe("resolverPublico — exclusões obrigatórias (não são opção de filtro)", () => {
  it("opt-out sempre exclui, mesmo batendo no segmento pedido", () => {
    const filtro: FiltroAudiencia = { inativoHaDias: 60 };
    const candidatos = [candidato({ pacienteId: "p1" }), candidato({ pacienteId: "p2", optOutEm: iso(dia(5)) })];
    const resultado = resolverPublico(candidatos, filtro, AGORA);

    expect(resultado.totalEncontrados).toBe(2);
    expect(resultado.elegiveis.map((c) => c.pacienteId)).toEqual(["p1"]);
    expect(resultado.excluidos).toEqual([{ candidato: candidatos[1], motivo: "opt_out" }]);
  });

  it("telefone inválido sempre exclui", () => {
    const filtro: FiltroAudiencia = {};
    const candidatos = [candidato({ pacienteId: "p1", telefone: "123" })];
    const resultado = resolverPublico(candidatos, filtro, AGORA);

    expect(resultado.totalEncontrados).toBe(1);
    expect(resultado.elegiveis).toEqual([]);
    expect(resultado.excluidos).toEqual([{ candidato: candidatos[0], motivo: "telefone_invalido" }]);
  });

  it("sem nenhum filtro, todo mundo é 'encontrado' e só opt-out/telefone tiram da lista", () => {
    const resultado = resolverPublico(
      [candidato({ pacienteId: "p1" }), candidato({ pacienteId: "p2" })],
      {},
      AGORA
    );
    expect(resultado.totalEncontrados).toBe(2);
    expect(resultado.elegiveis).toHaveLength(2);
  });
});
