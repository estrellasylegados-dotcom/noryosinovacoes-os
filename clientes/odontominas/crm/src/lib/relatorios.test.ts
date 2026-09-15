import { describe, expect, it } from "vitest";
import { agruparPorDia, agruparPorHora, diasDoPeriodo, inicioPeriodo, labelDia } from "@/lib/relatorios";

describe("inicioPeriodo", () => {
  it("'hoje' começa no início do dia atual em Brasília", () => {
    const agora = new Date("2026-09-15T18:00:00.000Z"); // 15h em Brasília
    expect(inicioPeriodo("hoje", agora).toISOString()).toBe("2026-09-15T03:00:00.000Z");
  });

  it("'7d' inclui hoje + 6 dias anteriores", () => {
    const agora = new Date("2026-09-15T18:00:00.000Z");
    expect(inicioPeriodo("7d", agora).toISOString()).toBe("2026-09-09T03:00:00.000Z");
  });
});

describe("diasDoPeriodo", () => {
  it("gera um dia por bucket, inclusive nas duas pontas", () => {
    const inicio = new Date("2026-09-13T03:00:00.000Z");
    const fim = new Date("2026-09-15T18:00:00.000Z");
    const dias = diasDoPeriodo(inicio, fim);
    expect(dias.map(labelDia)).toEqual(["13/09", "14/09", "15/09"]);
  });
});

describe("agruparPorDia", () => {
  const dias = diasDoPeriodo(new Date("2026-09-14T03:00:00.000Z"), new Date("2026-09-15T03:00:00.000Z"));

  it("classifica cada entrada no dia certo (Brasília) e por tipo", () => {
    const pontos = agruparPorDia(dias, [
      { quando: "2026-09-14T14:00:00.000Z", tipo: "paciente" }, // 11h em Brasília, dia 14
      { quando: "2026-09-15T02:30:00.000Z", tipo: "enviada" }, // 23h30 do dia 14 em Brasília — ainda dia 14
      { quando: "2026-09-15T14:00:00.000Z", tipo: "recebida" }, // dia 15
      { quando: "2026-09-15T15:00:00.000Z", tipo: "aberta" },
      { quando: "2026-09-15T16:00:00.000Z", tipo: "fechada" },
    ]);

    const dia14 = pontos.find((p) => p.label === "14/09")!;
    const dia15 = pontos.find((p) => p.label === "15/09")!;

    expect(dia14).toMatchObject({ novosPacientes: 1, enviadas: 1, recebidas: 0, abertas: 0, fechadas: 0 });
    expect(dia15).toMatchObject({ novosPacientes: 0, enviadas: 0, recebidas: 1, abertas: 1, fechadas: 1 });
  });

  it("dia sem nenhuma entrada fica com tudo zerado, não ausente", () => {
    const pontos = agruparPorDia(dias, []);
    expect(pontos).toHaveLength(2);
    expect(pontos.every((p) => p.novosPacientes === 0 && p.enviadas === 0)).toBe(true);
  });

  it("entrada fora da janela é ignorada (não estoura)", () => {
    const pontos = agruparPorDia(dias, [{ quando: "2020-01-01T12:00:00.000Z", tipo: "paciente" }]);
    expect(pontos.reduce((soma, p) => soma + p.novosPacientes, 0)).toBe(0);
  });
});

describe("agruparPorHora", () => {
  it("agrupa em blocos de 3h, em Brasília", () => {
    const pontos = agruparPorHora([
      { quando: "2026-09-15T13:05:00.000Z", direcao: "enviada" }, // 10h05 Brasília -> bucket 09h
      { quando: "2026-09-15T14:59:00.000Z", direcao: "recebida" }, // 11h59 Brasília -> bucket 09h
      { quando: "2026-09-15T02:00:00.000Z", direcao: "recebida" }, // 23h Brasília (dia anterior) -> bucket 21h
    ]);

    expect(pontos.find((p) => p.label === "09h")).toEqual({ label: "09h", enviadas: 1, recebidas: 1 });
    expect(pontos.find((p) => p.label === "21h")).toEqual({ label: "21h", enviadas: 0, recebidas: 1 });
    expect(pontos).toHaveLength(8);
  });
});
