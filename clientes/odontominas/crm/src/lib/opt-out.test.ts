import { describe, expect, it } from "vitest";
import { detectarPedidoOptOut } from "@/lib/opt-out";

describe("detectarPedidoOptOut", () => {
  it.each([
    "parar",
    "PARAR",
    "Parar",
    "pare",
    "sair",
    "stop",
    "cancelar",
    "remover",
    "descadastrar",
    "pode parar de mandar mensagem, por favor",
    "não quero mais receber mensagens de vocês",
    "quero sair da lista",
    "me remova dessa lista por favor",
    "não mandem mais mensagem pra mim",
  ])('detecta pedido de opt-out em: "%s"', (mensagem) => {
    expect(detectarPedidoOptOut(mensagem)).toBe(true);
  });

  it.each([
    "",
    "oi, bom dia",
    "posso parar de usar o fio dental?",
    "vou parar no consultório às 15h",
    "quanto custa a avaliação?",
    "quero agendar uma consulta",
    "vou sair mais cedo do trabalho pra ir aí",
    "obrigada!",
  ])('não detecta pedido de opt-out em: "%s"', (mensagem) => {
    expect(detectarPedidoOptOut(mensagem)).toBe(false);
  });
});
