import { describe, expect, it } from "vitest";
import { hashSha256 } from "@/lib/pixel-facebook";
import { montarEventoGoogleAds } from "@/lib/pixel-google-ads";

describe("montarEventoGoogleAds", () => {
  const agora = new Date("2026-09-16T12:00:00Z");
  const params = { conversaId: "conversa-1", telefone: "556199990000" };
  const configBase = {
    customerId: "1234567890",
    loginCustomerId: null,
    conversionActionIdPorEvento: { agendado: "999888777" },
  };

  it("volta null quando o evento não tem Ação de Conversão configurada (evento opcional não usado)", async () => {
    expect(await montarEventoGoogleAds("novo_lead", params, configBase, agora)).toBeNull();
  });

  it("monta o payload quando a Ação de Conversão do evento existe", async () => {
    const payload = await montarEventoGoogleAds("agendado", params, configBase, agora);
    expect(payload).not.toBeNull();
    expect(payload!.destinations[0].productDestinationId).toBe("999888777");
  });

  it("sem Login Customer ID, usa o próprio Customer ID como loginAccount", async () => {
    const payload = (await montarEventoGoogleAds("agendado", params, configBase, agora))!;
    expect(payload.destinations[0].operatingAccount.accountId).toBe("1234567890");
    expect(payload.destinations[0].loginAccount.accountId).toBe("1234567890");
  });

  it("com Login Customer ID (conta MCC), usa ele como loginAccount", async () => {
    const payload = (await montarEventoGoogleAds("agendado", params, { ...configBase, loginCustomerId: "5550001111" }, agora))!;
    expect(payload.destinations[0].loginAccount.accountId).toBe("5550001111");
  });

  it("transactionId combina conversaId e evento — dedup do lado do Google", async () => {
    const payload = (await montarEventoGoogleAds("agendado", params, configBase, agora))!;
    expect(payload.events[0].transactionId).toBe("conversa-1:agendado");
  });

  it("telefone vai em E.164 (com DDI e '+') e hasheado, nunca em texto puro", async () => {
    const payload = (await montarEventoGoogleAds("agendado", params, configBase, agora))!;
    expect(payload.events[0].userData.userIdentifiers[0].phoneNumber).toBe(await hashSha256(`+${params.telefone}`));
    expect(JSON.stringify(payload)).not.toContain(params.telefone);
  });

  it("eventTimestamp é ISO 8601", async () => {
    const payload = (await montarEventoGoogleAds("agendado", params, configBase, agora))!;
    expect(payload.events[0].eventTimestamp).toBe(agora.toISOString());
  });
});
