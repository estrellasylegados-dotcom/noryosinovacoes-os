import { describe, expect, it } from "vitest";
import { encontrarCorrespondenciaPaciente, type CandidatoPaciente } from "./patients";

function candidato(overrides: Partial<CandidatoPaciente>): CandidatoPaciente {
  return { externalId: null, telefone: null, cpf: null, email: null, ...overrides };
}

describe("encontrarCorrespondenciaPaciente", () => {
  it("prioriza id externo já conhecido sobre qualquer outro critério", () => {
    const candidatos = [candidato({ externalId: "ext-1", telefone: "5561999990000" }), candidato({ externalId: "ext-2" })];
    const r = encontrarCorrespondenciaPaciente({ externalId: "ext-1", telefone: "5561988880000" }, candidatos);
    expect(r).toEqual({ tipo: "external_id", candidato: candidatos[0] });
  });

  it("sem id externo batendo, cai pro telefone normalizado (reaproveita normalizarTelefoneEntrada)", () => {
    const candidatos = [candidato({ telefone: "5561999990000" })];
    const r = encontrarCorrespondenciaPaciente({ telefone: "(61) 99999-0000" }, candidatos);
    expect(r).toEqual({ tipo: "telefone", candidato: candidatos[0] });
  });

  it("paciente sem telefone cai pro próximo critério (CPF)", () => {
    const candidatos = [candidato({ cpf: "11122233344" })];
    const r = encontrarCorrespondenciaPaciente({ telefone: null, cpf: "11122233344" }, candidatos);
    expect(r).toEqual({ tipo: "cpf", candidato: candidatos[0] });
  });

  it("e-mail (case-insensitive) é o último critério automático antes de needs_review", () => {
    const candidatos = [candidato({ email: "paciente@exemplo.com" })];
    const r = encontrarCorrespondenciaPaciente({ email: "PACIENTE@exemplo.com" }, candidatos);
    expect(r).toEqual({ tipo: "email", candidato: candidatos[0] });
  });

  it("paciente duplicado (2 candidatos batendo no mesmo telefone) nunca escolhe sozinho — needs_review", () => {
    const candidatos = [candidato({ telefone: "5561999990000" }), candidato({ telefone: "5561999990000" })];
    const r = encontrarCorrespondenciaPaciente({ telefone: "5561999990000" }, candidatos);
    expect(r).toEqual({ tipo: "needs_review" });
  });

  it("nenhum critério bate: needs_review — nunca casamento por nome", () => {
    const r = encontrarCorrespondenciaPaciente({ telefone: "5561999990000" }, []);
    expect(r).toEqual({ tipo: "needs_review" });
  });
});
