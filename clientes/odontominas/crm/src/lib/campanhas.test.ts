import { describe, expect, it } from "vitest";
import { intervaloEnvioMs, montarLinhasDestinatarios } from "@/lib/campanhas";
import type { CandidatoAudiencia } from "@/lib/audiencias";

function candidato(overrides: Partial<CandidatoAudiencia>): CandidatoAudiencia {
  return {
    pacienteId: "p1",
    conversaId: "c1",
    telefone: "5561999999999",
    nome: "Maria Silva",
    statusConversa: "respondido",
    ultimaMensagemEm: null,
    etiquetaIds: [],
    optOutEm: null,
    ...overrides,
  };
}

describe("intervaloEnvioMs", () => {
  it("sempre cai dentro do intervalo pedido (jitter anti-shadowban)", () => {
    for (let i = 0; i < 200; i++) {
      const ms = intervaloEnvioMs(15_000, 25_000);
      expect(ms).toBeGreaterThanOrEqual(15_000);
      expect(ms).toBeLessThan(25_000);
    }
  });

  it("respeita min/max customizados", () => {
    for (let i = 0; i < 50; i++) {
      const ms = intervaloEnvioMs(1000, 2000);
      expect(ms).toBeGreaterThanOrEqual(1000);
      expect(ms).toBeLessThan(2000);
    }
  });
});

describe("montarLinhasDestinatarios", () => {
  it("gera 1 linha por elegível, pendente, com ordem sequencial e sem reconsultar Supabase", () => {
    const elegiveis = [
      candidato({ pacienteId: "p1", conversaId: "c1", telefone: "5561999999991", nome: "Ana" }),
      candidato({ pacienteId: "p2", conversaId: "c2", telefone: "5561999999992", nome: "Bia" }),
      candidato({ pacienteId: "p3", conversaId: null, telefone: "5561999999993", nome: null }),
    ];

    const linhas = montarLinhasDestinatarios(elegiveis);

    expect(linhas).toEqual([
      { paciente_id: "p1", conversa_id: "c1", telefone: "5561999999991", nome: "Ana", ordem: 0, status: "pendente" },
      { paciente_id: "p2", conversa_id: "c2", telefone: "5561999999992", nome: "Bia", ordem: 1, status: "pendente" },
      { paciente_id: "p3", conversa_id: null, telefone: "5561999999993", nome: null, ordem: 2, status: "pendente" },
    ]);
  });

  it("lista vazia gera zero linhas", () => {
    expect(montarLinhasDestinatarios([])).toEqual([]);
  });
});
