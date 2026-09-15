/**
 * Interpretação do conteúdo de uma mensagem da Evolution API (payload
 * Baileys). Cobre os tipos comuns; qualquer coisa fora daqui cai em "outro"
 * mas o payload cru inteiro sempre é gravado à parte (coluna `raw`), então
 * nada se perde mesmo quando o tipo não é reconhecido aqui.
 */

type MessageContent = Record<string, unknown> | null | undefined;

export type MensagemExtraida = { tipo: string; conteudo: string | null };

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function extractMensagem(message: MessageContent, messageType?: string): MensagemExtraida {
  if (!message) return { tipo: messageType || "desconhecido", conteudo: null };

  const conversation = asString(message.conversation);
  if (conversation) return { tipo: "texto", conteudo: conversation };

  const extended = asRecord(message.extendedTextMessage);
  const extendedText = extended && asString(extended.text);
  if (extendedText) return { tipo: "texto", conteudo: extendedText };

  const image = asRecord(message.imageMessage);
  if (image) return { tipo: "imagem", conteudo: asString(image.caption) ?? null };

  const video = asRecord(message.videoMessage);
  if (video) return { tipo: "video", conteudo: asString(video.caption) ?? null };

  const audio = asRecord(message.audioMessage);
  if (audio) return { tipo: audio.ptt === true ? "audio_voz" : "audio", conteudo: null };

  const document = asRecord(message.documentMessage);
  if (document) {
    return { tipo: "documento", conteudo: asString(document.caption) ?? asString(document.fileName) ?? null };
  }

  if (message.stickerMessage) return { tipo: "figurinha", conteudo: null };

  if (message.locationMessage) return { tipo: "localizacao", conteudo: null };

  const reaction = asRecord(message.reactionMessage);
  if (reaction) return { tipo: "reacao", conteudo: asString(reaction.text) ?? null };

  const buttonsResponse = asRecord(message.buttonsResponseMessage);
  if (buttonsResponse) {
    return { tipo: "resposta_botao", conteudo: asString(buttonsResponse.selectedDisplayText) ?? null };
  }

  const listResponse = asRecord(message.listResponseMessage);
  if (listResponse) {
    return { tipo: "resposta_lista", conteudo: asString(listResponse.title) ?? null };
  }

  return { tipo: messageType || "outro", conteudo: null };
}

/** Extrai o telefone (só dígitos) de um remoteJid, removendo sufixo de device (":16"). */
export function normalizeTelefone(remoteJid: string): string | null {
  const [user] = remoteJid.split("@");
  if (!user) return null;
  const digits = user.split(":")[0].replace(/\D/g, "");
  return digits || null;
}

export function isGroupOrBroadcast(remoteJid: string): boolean {
  return remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast");
}
