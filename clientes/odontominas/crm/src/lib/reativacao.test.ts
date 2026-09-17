import { describe, expect, it } from "vitest";
import {
  LIMITE_INATIVIDADE_MS,
  montarMensagemReativacao,
  selecionarCandidatos,
  type ConversaParaReativacao,
} from "@/lib/reativacao";
import type { StatusConversa } from "@/lib/status";

const dia = (n: number) => n * 24 * 60 * 60 * 1000;
const AGORA = new Date("2026-09-15T12:00:00Z").getTime();
const iso = (msAtras: number) => new Date(AGORA - msAtras).toISOString();

function conversa(overrides: Partial<ConversaParaReativacao>): ConversaParaReativacao {
  return {
    id: "c1",
    telefone: "5561999999999",
    pacienteId: "p1",
    pacienteNome: "Maria Silva",
    status: "respondido",
    ultimaMensagemEm: iso(dia(40)),
    ultimaReativacaoEm: null,
    ...overrides,
  };
}

describe("selecionarCandidatos — status elegível", () => {
  it.each(["respondido", "agendado", "perdido"] as StatusConversa[])(
    "conversa resolvida ('%s') inativa há mais que o limite entra",
    (status) => {
      const candidatos = selecionarCandidatos([conversa({ status })], AGORA);
      expect(candidatos.map((c) => c.id)).toEqual(["c1"]);
    }
  );

  it.each(["novo", "aguardando"] as StatusConversa[])(
    "conversa em aberto ('%s') nunca entra, mesmo inativa há muito tempo",
    (status) => {
      const candidatos = selecionarCandidatos([conversa({ status, ultimaMensagemEm: iso(dia(90)) })], AGORA);
      expect(candidatos).toEqual([]);
    }
  );
});

describe("selecionarCandidatos — limite de inatividade", () => {
  it("abaixo do limite não entra", () => {
    const candidatos = selecionarCandidatos([conversa({ ultimaMensagemEm: iso(dia(10)) })], AGORA);
    expect(candidatos).toEqual([]);
  });

  it("exatamente no limite não entra (precisa passar do limite)", () => {
    const candidatos = selecionarCandidatos([conversa({ ultimaMensagemEm: iso(LIMITE_INATIVIDADE_MS) })], AGORA);
    expect(candidatos).toEqual([]);
  });

  it("sem ultima_mensagem_em não entra (nada pra medir)", () => {
    const candidatos = selecionarCandidatos([conversa({ ultimaMensagemEm: null })], AGORA);
    expect(candidatos).toEqual([]);
  });
});

describe("selecionarCandidatos — já reativada", () => {
  it("conversa com ultima_reativacao_em setada nunca entra de novo (V1: 1x só)", () => {
    const candidatos = selecionarCandidatos([conversa({ ultimaReativacaoEm: iso(dia(5)) })], AGORA);
    expect(candidatos).toEqual([]);
  });
});

describe("montarMensagemReativacao", () => {
  it("com nome, usa só o primeiro nome", () => {
    expect(montarMensagemReativacao("Maria Silva Souza")).toContain("Oi, Maria!");
  });

  it("sem nome, saudação genérica", () => {
    expect(montarMensagemReativacao(null)).toContain("Oi!");
  });

  it("nunca promete resultado nem usa superlativo (compliance CFO-196/2019)", () => {
    const texto = montarMensagemReativacao("Ana").toLowerCase();
    for (const termo of ["melhor", "número 1", "garantid", "cura", "especialista"]) {
      expect(texto).not.toContain(termo);
    }
  });

  it("usa o nome da clínica passado, nunca um hardcode (Fase 3, branding dinâmico)", () => {
    expect(montarMensagemReativacao("Ana", "Sorriso Feliz")).toContain("Aqui é da Sorriso Feliz");
    expect(montarMensagemReativacao("Ana", "Sorriso Feliz")).not.toContain("OdontoMinas");
  });

  it("sem clínica informada, cai num fallback genérico (nunca quebra o chamador antigo)", () => {
    expect(montarMensagemReativacao("Ana")).toContain("Aqui é da nossa clínica");
  });
});
