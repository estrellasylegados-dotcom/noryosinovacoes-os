import { describe, expect, it } from "vitest";
import { hashSha256, montarEventoFacebook } from "@/lib/pixel-facebook";

describe("hashSha256", () => {
  it("é determinístico pro mesmo valor", async () => {
    expect(await hashSha256("556199990000")).toBe(await hashSha256("556199990000"));
  });

  it("normaliza (trim + lowercase) antes de hashear — mesmo valor com espaço/caixa diferente gera o mesmo hash", async () => {
    expect(await hashSha256("ABC")).toBe(await hashSha256(" abc "));
  });

  it("valores diferentes geram hashes diferentes", async () => {
    expect(await hashSha256("556199990000")).not.toBe(await hashSha256("556199990001"));
  });

  it("sempre 64 caracteres hexadecimais (SHA-256 em hex)", async () => {
    expect(await hashSha256("556199990000")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("montarEventoFacebook", () => {
  const agora = new Date("2026-09-16T12:00:00Z");
  const params = { conversaId: "conversa-1", telefone: "556199990000" };

  it("mapeia cada evento pro event_name certo", async () => {
    expect((await montarEventoFacebook("novo_lead", params, agora)).data[0].event_name).toBe("Lead");
    expect((await montarEventoFacebook("lead_quente", params, agora)).data[0].event_name).toBe("LeadQualificado");
    expect((await montarEventoFacebook("agendado", params, agora)).data[0].event_name).toBe("Schedule");
  });

  it("action_source é business_messaging — não é evento de site", async () => {
    expect((await montarEventoFacebook("novo_lead", params, agora)).data[0].action_source).toBe("business_messaging");
  });

  it("event_id combina conversaId e evento — dedup do lado da Meta", async () => {
    expect((await montarEventoFacebook("agendado", params, agora)).data[0].event_id).toBe("conversa-1:agendado");
  });

  it("event_time é o timestamp Unix em segundos", async () => {
    expect((await montarEventoFacebook("novo_lead", params, agora)).data[0].event_time).toBe(Math.floor(agora.getTime() / 1000));
  });

  it("telefone vai hasheado, nunca em texto puro", async () => {
    const evento = await montarEventoFacebook("novo_lead", params, agora);
    expect(evento.data[0].user_data.ph).toEqual([await hashSha256(params.telefone)]);
    expect(JSON.stringify(evento)).not.toContain(params.telefone);
  });
});
