import { describe, expect, it } from "vitest";
import { dentroDaJanela, horaAtualNaTimezone, selecionarPacientesAniversario, TIMEZONE_PADRAO } from "@/lib/fluxo-scanner-temporal";

describe("horaAtualNaTimezone", () => {
  it('formata a hora em "HH" na timezone dada', () => {
    // 12:00 UTC = 09:00 em America/Sao_Paulo (UTC-3)
    expect(horaAtualNaTimezone(new Date("2026-09-17T12:00:00.000Z"), TIMEZONE_PADRAO)).toBe("09");
  });
});

describe("dentroDaJanela", () => {
  const agora = new Date("2026-09-17T12:00:00.000Z"); // 09:00 em America/Sao_Paulo

  it("horário configurado bate com a hora atual: dentro da janela", () => {
    expect(dentroDaJanela(agora, "09:00", TIMEZONE_PADRAO)).toBe(true);
  });

  it("horário configurado não bate: fora da janela", () => {
    expect(dentroDaJanela(agora, "15:00", TIMEZONE_PADRAO)).toBe(false);
  });

  it("sem horário configurado, usa padrão 09:00", () => {
    expect(dentroDaJanela(agora, undefined, TIMEZONE_PADRAO)).toBe(true);
    expect(dentroDaJanela(new Date("2026-09-17T18:00:00.000Z"), undefined, TIMEZONE_PADRAO)).toBe(false);
  });
});

describe("selecionarPacientesAniversario", () => {
  it("seleciona só quem tem mês/dia de nascimento igual a hoje", () => {
    const pacientes = [
      { id: "p1", dataNascimento: "1990-09-17" },
      { id: "p2", dataNascimento: "1985-09-18" },
      { id: "p3", dataNascimento: "2001-09-17" },
    ];
    expect(selecionarPacientesAniversario(pacientes, "09-17").sort()).toEqual(["p1", "p3"]);
  });

  it("paciente sem data_nascimento nunca entra", () => {
    const pacientes = [{ id: "p1", dataNascimento: null }];
    expect(selecionarPacientesAniversario(pacientes, "09-17")).toEqual([]);
  });

  it("ano de nascimento diferente não importa — só mês/dia", () => {
    const pacientes = [{ id: "p1", dataNascimento: "1950-01-01" }];
    expect(selecionarPacientesAniversario(pacientes, "01-01")).toEqual(["p1"]);
  });

  it("lista vazia: nenhum candidato", () => {
    expect(selecionarPacientesAniversario([], "09-17")).toEqual([]);
  });
});
