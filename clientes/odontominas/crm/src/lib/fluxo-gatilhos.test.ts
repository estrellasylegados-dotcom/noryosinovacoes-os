import { describe, expect, it } from "vitest";
import { combinaGatilhoMensagem, dedupeKeyParaGatilho } from "@/lib/fluxo-gatilhos";

describe("combinaGatilhoMensagem", () => {
  it("nova_conversa bate só quando a conversa é nova", () => {
    expect(combinaGatilhoMensagem("nova_conversa", {}, { conversaEhNova: true, textoMensagem: "oi" })).toBe(true);
    expect(combinaGatilhoMensagem("nova_conversa", {}, { conversaEhNova: false, textoMensagem: "oi" })).toBe(false);
  });

  it("primeira_mensagem tem o mesmo critério de nova_conversa", () => {
    expect(combinaGatilhoMensagem("primeira_mensagem", {}, { conversaEhNova: true, textoMensagem: "oi" })).toBe(true);
  });

  it("palavra_chave bate por substring, case/acento-insensível", () => {
    const config = { palavras: ["Agendar", "orçamento"] };
    expect(combinaGatilhoMensagem("palavra_chave", config, { conversaEhNova: false, textoMensagem: "quero AGENDAR uma consulta" })).toBe(
      true
    );
    expect(combinaGatilhoMensagem("palavra_chave", config, { conversaEhNova: false, textoMensagem: "qual o orcamento?" })).toBe(true);
    expect(combinaGatilhoMensagem("palavra_chave", config, { conversaEhNova: false, textoMensagem: "bom dia" })).toBe(false);
  });

  it("palavra_chave sem palavras configuradas nunca bate", () => {
    expect(combinaGatilhoMensagem("palavra_chave", {}, { conversaEhNova: true, textoMensagem: "agendar" })).toBe(false);
  });

  it("gatilho_tipo desconhecido nunca bate", () => {
    expect(combinaGatilhoMensagem("etapa_funil", {}, { conversaEhNova: true, textoMensagem: "oi" })).toBe(false);
  });
});

describe("dedupeKeyParaGatilho", () => {
  it("nova_conversa/primeira_mensagem usam a conversa como chave permanente", () => {
    expect(dedupeKeyParaGatilho("nova_conversa", "conversa-1")).toBe("conversa-1");
    expect(dedupeKeyParaGatilho("primeira_mensagem", "conversa-1")).toBe("conversa-1");
  });

  it("palavra_chave não tem dedupe (pode reabrir o mesmo fluxo depois)", () => {
    expect(dedupeKeyParaGatilho("palavra_chave", "conversa-1")).toBeNull();
  });
});
