import { describe, expect, it } from "vitest";
import { detectarIntencaoCompra, detectarPedidoHumano, montarMensagemNotificacao } from "@/lib/agentes-notificacoes";

describe("detectarPedidoHumano", () => {
  it.each([
    "quero falar com um atendente",
    "posso falar com um humano?",
    "queria falar com uma pessoa de verdade",
    "me passa pra recepcionista",
    "não quero falar com robô",
    "isso aqui não é um robô?",
  ])('detecta pedido de humano em: "%s"', (mensagem) => {
    expect(detectarPedidoHumano(mensagem)).toBe(true);
  });

  it.each(["oi, bom dia", "quero saber sobre implante", "quanto custa a avaliação?", "obrigada!"])(
    'não detecta pedido de humano em: "%s"',
    (mensagem) => {
      expect(detectarPedidoHumano(mensagem)).toBe(false);
    }
  );
});

describe("detectarIntencaoCompra", () => {
  it.each([
    "quero agendar uma consulta",
    "posso marcar um horário?",
    "quanto custa o implante?",
    "qual o valor da avaliação",
    "vocês têm vaga essa semana?",
  ])('detecta intenção de agendar/comprar em: "%s"', (mensagem) => {
    expect(detectarIntencaoCompra(mensagem)).toBe(true);
  });

  it.each(["oi, bom dia", "qual o endereço da clínica?", "vocês atendem convênio?"])(
    'não detecta intenção de agendar/comprar em: "%s"',
    (mensagem) => {
      expect(detectarIntencaoCompra(mensagem)).toBe(false);
    }
  );
});

describe("montarMensagemNotificacao", () => {
  it("substitui as 4 variáveis no template", () => {
    const resultado = montarMensagemNotificacao("{motivo}: {nome} ({telefone}) disse \"{resumo}\"", {
      motivo: "Pedido de atendimento humano",
      nome: "Camila Duarte",
      telefone: "(61) 99999-0001",
      resumo: "quero falar com atendente",
    });
    expect(resultado).toBe('Pedido de atendimento humano: Camila Duarte ((61) 99999-0001) disse "quero falar com atendente"');
  });

  it("ignora variável repetida mais de uma vez", () => {
    const resultado = montarMensagemNotificacao("{nome} - {nome}", {
      motivo: "x",
      nome: "Ana",
      telefone: "123",
      resumo: "y",
    });
    expect(resultado).toBe("Ana - Ana");
  });
});
