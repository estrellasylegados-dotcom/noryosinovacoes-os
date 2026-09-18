import { describe, expect, it } from "vitest";
import { extractMensagem, isGroupOrBroadcast, normalizeTelefone } from "@/lib/evolution-webhook";

describe("normalizeTelefone", () => {
  it("extrai só dígitos do usuário antes do @", () => {
    // Fixo (local começa em 2-5): mecânica de extração isolada da regra BR
    // de 9º dígito, testada à parte logo abaixo.
    expect(normalizeTelefone("556233334444@s.whatsapp.net")).toBe("556233334444");
  });

  it("remove o sufixo de device (:N)", () => {
    expect(normalizeTelefone("556233334444:16@s.whatsapp.net")).toBe("556233334444");
  });

  it("devolve null pra remoteJid vazio ou sem dígitos", () => {
    expect(normalizeTelefone("@s.whatsapp.net")).toBeNull();
    expect(normalizeTelefone("abc@s.whatsapp.net")).toBeNull();
  });

  it("celular BR sem o 9º dígito no JID (achado real em produção, 2026-09-18) ganha o 9 de volta", () => {
    expect(normalizeTelefone("556181925241@s.whatsapp.net")).toBe("5561981925241");
  });

  it("celular BR já com o 9º dígito no JID fica intacto", () => {
    expect(normalizeTelefone("5561981925241@s.whatsapp.net")).toBe("5561981925241");
  });
});

describe("isGroupOrBroadcast", () => {
  it("reconhece grupo (@g.us)", () => {
    expect(isGroupOrBroadcast("12345-67890@g.us")).toBe(true);
  });

  it("reconhece broadcast", () => {
    expect(isGroupOrBroadcast("status@broadcast")).toBe(true);
  });

  it("não marca conversa 1:1 normal", () => {
    expect(isGroupOrBroadcast("556299998888@s.whatsapp.net")).toBe(false);
  });
});

describe("extractMensagem", () => {
  it("mensagem sem payload cai em tipo desconhecido", () => {
    expect(extractMensagem(null, undefined)).toEqual({ tipo: "desconhecido", conteudo: null });
    expect(extractMensagem(undefined, "algumTipo")).toEqual({ tipo: "algumTipo", conteudo: null });
  });

  it("texto simples (conversation)", () => {
    expect(extractMensagem({ conversation: "Olá, tudo bem?" })).toEqual({
      tipo: "texto",
      conteudo: "Olá, tudo bem?",
    });
  });

  it("texto com preview de link (extendedTextMessage)", () => {
    expect(extractMensagem({ extendedTextMessage: { text: "vejam isso" } })).toEqual({
      tipo: "texto",
      conteudo: "vejam isso",
    });
  });

  it("imagem com legenda", () => {
    expect(extractMensagem({ imageMessage: { caption: "raio-x" } })).toEqual({
      tipo: "imagem",
      conteudo: "raio-x",
    });
  });

  it("imagem sem legenda", () => {
    expect(extractMensagem({ imageMessage: {} })).toEqual({ tipo: "imagem", conteudo: null });
  });

  it("áudio comum vs. áudio de voz (ptt)", () => {
    expect(extractMensagem({ audioMessage: { ptt: false } })).toEqual({ tipo: "audio", conteudo: null });
    expect(extractMensagem({ audioMessage: { ptt: true } })).toEqual({ tipo: "audio_voz", conteudo: null });
  });

  it("documento usa caption, cai pro nome do arquivo", () => {
    expect(extractMensagem({ documentMessage: { fileName: "exame.pdf" } })).toEqual({
      tipo: "documento",
      conteudo: "exame.pdf",
    });
    expect(extractMensagem({ documentMessage: { caption: "resultado", fileName: "exame.pdf" } })).toEqual({
      tipo: "documento",
      conteudo: "resultado",
    });
  });

  it("figurinha e localização não têm conteúdo de texto", () => {
    expect(extractMensagem({ stickerMessage: {} })).toEqual({ tipo: "figurinha", conteudo: null });
    expect(extractMensagem({ locationMessage: {} })).toEqual({ tipo: "localizacao", conteudo: null });
  });

  it("resposta de botão e de lista", () => {
    expect(extractMensagem({ buttonsResponseMessage: { selectedDisplayText: "Sim" } })).toEqual({
      tipo: "resposta_botao",
      conteudo: "Sim",
    });
    expect(extractMensagem({ listResponseMessage: { title: "Manhã" } })).toEqual({
      tipo: "resposta_lista",
      conteudo: "Manhã",
    });
  });

  it("tipo não reconhecido cai em 'outro', mas nunca lança erro", () => {
    expect(extractMensagem({ algumTipoNovo: {} }, "algumTipoNovo")).toEqual({
      tipo: "algumTipoNovo",
      conteudo: null,
    });
  });
});
