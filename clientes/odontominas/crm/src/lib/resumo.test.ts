import { describe, expect, it } from "vitest";
import { calcularResumo } from "@/lib/resumo";
import type { ConversaPainel } from "@/lib/conversas";

const min = (n: number) => n * 60_000;

function conversa(overrides: Partial<ConversaPainel>): ConversaPainel {
  return {
    id: "c",
    telefone: "1",
    pacienteId: null,
    pacienteNome: null,
    status: "novo",
    aguardandoDesde: null,
    ultimaMensagemEm: null,
    tempoPrimeiraRespostaMs: null,
    ...overrides,
  };
}

describe("calcularResumo — tempo médio até 1ª resposta", () => {
  it("só considera conversas respondido/agendado com tempo registrado", () => {
    const conversas = [
      conversa({ id: "a", status: "respondido", tempoPrimeiraRespostaMs: min(10) }),
      conversa({ id: "b", status: "agendado", tempoPrimeiraRespostaMs: min(20) }),
      conversa({ id: "c", status: "perdido", tempoPrimeiraRespostaMs: null }), // nunca respondida
      conversa({ id: "d", status: "novo", tempoPrimeiraRespostaMs: min(5) }), // ainda em aberto, não conta
    ];
    const contagens = { novo: 1, aguardando: 0, respondido: 1, agendado: 1, perdido: 1 };

    const resumo = calcularResumo(conversas, contagens);
    expect(resumo.tempoMedioRespostaMs).toBe(min(15));
  });

  it("sem nenhuma conversa respondida ainda, tempo médio é null (não zero)", () => {
    const conversas = [conversa({ status: "novo", tempoPrimeiraRespostaMs: min(5) })];
    const contagens = { novo: 1, aguardando: 0, respondido: 0, agendado: 0, perdido: 0 };

    expect(calcularResumo(conversas, contagens).tempoMedioRespostaMs).toBeNull();
  });
});

describe("calcularResumo — leads esfriando", () => {
  it("só conversas em aberto acima do limite, da espera mais longa pra mais curta", () => {
    const conversas = [
      conversa({ id: "curta", status: "novo", tempoPrimeiraRespostaMs: min(10) }), // abaixo do limite (30min)
      conversa({ id: "longa", status: "aguardando", tempoPrimeiraRespostaMs: min(90) }),
      conversa({ id: "media", status: "novo", tempoPrimeiraRespostaMs: min(45) }),
      conversa({ id: "resolvida", status: "respondido", tempoPrimeiraRespostaMs: min(120) }), // não está em aberto
    ];
    const contagens = { novo: 2, aguardando: 1, respondido: 1, agendado: 0, perdido: 0 };

    const resumo = calcularResumo(conversas, contagens);
    expect(resumo.leadsEsfriando.map((c) => c.id)).toEqual(["longa", "media"]);
  });
});

describe("calcularResumo — total", () => {
  it("soma todas as contagens de status", () => {
    const contagens = { novo: 2, aguardando: 1, respondido: 3, agendado: 1, perdido: 4 };
    expect(calcularResumo([], contagens).total).toBe(11);
  });
});
