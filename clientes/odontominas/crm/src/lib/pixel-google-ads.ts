import type { EnvioPixelResultado, EventoPixel } from "@/lib/pixel-facebook";
import { hashSha256 } from "@/lib/pixel-facebook";

/**
 * Google Ads — Data Manager API (`datamanager.googleapis.com/v1/events:ingest`).
 * A pedido do Rafael, mesma origem da aba Pixel (print da RoiZap) que o
 * Facebook Conversions API (pixel-facebook.ts).
 *
 * Achado de pesquisa que mudou o desenho: a rota clássica do Google Ads API
 * (`OfflineUserDataJobService`/`UploadClickConversions`) está bloqueada pra
 * conta nova desde abr/jun 2026 — o caminho vigente é a Data Manager API,
 * que **não usa developer token**, só OAuth2 (escopo `.../auth/datamanager`)
 * + um `Destination` com o Customer ID em vez de header de conta. Client
 * ID/Secret são infraestrutura da Noryos (`GOOGLE_ADS_OAUTH_CLIENT_ID/SECRET`
 * no env, 1 app só, reaproveitado por qualquer cliente); Refresh Token,
 * Customer ID e os IDs de Ação de Conversão são por-agente (formulário,
 * aba Pixel) — o refresh token é gerado 1x pelo Rafael com a conta de
 * anúncio do cliente (fora deste sistema, ex. OAuth Playground) e colado.
 *
 * Essa API é posterior ao corte de conhecimento deste agente (a migração
 * forçada é de jun/2026) — o formato exato de campo foi montado a partir da
 * documentação pesquisada nesta sessão, não de memória treinada. Validar
 * contra uma conta real na 1ª vez que o Rafael tiver uma (`validateOnly:
 * true` no payload serve pra esse teste sem gerar conversão de verdade).
 */

export type ConfigGoogleAdsPixel = {
  /** Customer ID da conta de Google Ads, só dígitos (sem "AW-" nem traço). */
  customerId: string;
  /** Conta MCC que gerencia a de cima — só quando aplicável; vazio = usa o próprio customerId. */
  loginCustomerId?: string | null;
  refreshToken: string;
  conversionActionIdPorEvento: Partial<Record<EventoPixel, string>>;
};

export type ParametrosEventoPixelGoogle = {
  conversaId: string;
  /** Só dígitos, com DDI — mesmo formato que `normalizeTelefone` (evolution-webhook.ts) já produz. */
  telefone: string;
};

export type PayloadGoogleAds = {
  destinations: Array<{
    operatingAccount: { accountType: "GOOGLE_ADS"; accountId: string };
    loginAccount: { accountType: "GOOGLE_ADS"; accountId: string };
    productDestinationId: string;
  }>;
  encoding: "HEX";
  events: Array<{
    eventTimestamp: string;
    transactionId: string;
    userData: { userIdentifiers: Array<{ phoneNumber: string }> };
  }>;
  validateOnly: boolean;
};

/** Monta o payload — `null` quando este evento não tem Ação de Conversão configurada (evento opcional não usado). */
export async function montarEventoGoogleAds(
  evento: EventoPixel,
  params: ParametrosEventoPixelGoogle,
  config: Pick<ConfigGoogleAdsPixel, "customerId" | "loginCustomerId" | "conversionActionIdPorEvento">,
  agora: Date = new Date()
): Promise<PayloadGoogleAds | null> {
  const conversionActionId = config.conversionActionIdPorEvento[evento];
  if (!conversionActionId) return null;

  const loginAccountId = config.loginCustomerId?.trim() || config.customerId;

  return {
    destinations: [
      {
        operatingAccount: { accountType: "GOOGLE_ADS", accountId: config.customerId },
        loginAccount: { accountType: "GOOGLE_ADS", accountId: loginAccountId },
        productDestinationId: conversionActionId,
      },
    ],
    encoding: "HEX",
    events: [
      {
        eventTimestamp: agora.toISOString(),
        transactionId: `${params.conversaId}:${evento}`,
        // E.164 (com "+") antes do hash — normalização que a Enhanced Conversions do Google documenta pra telefone.
        userData: { userIdentifiers: [{ phoneNumber: await hashSha256(`+${params.telefone}`) }] },
      },
    ],
    validateOnly: false,
  };
}

async function obterAccessTokenGoogle(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_ADS_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[pixel-google-ads] oauth_app_nao_configurado");
    return null;
  }

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[pixel-google-ads] token_failed", JSON.stringify({ status: res.status, body: body.slice(0, 300) }));
      return null;
    }

    const dados = (await res.json()) as { access_token?: string };
    return dados.access_token ?? null;
  } catch (e) {
    console.error("[pixel-google-ads] token_request_error", JSON.stringify({ message: (e as Error).message }));
    return null;
  }
}

export async function enviarEventoGoogleAds(
  config: ConfigGoogleAdsPixel,
  evento: EventoPixel,
  params: ParametrosEventoPixelGoogle
): Promise<EnvioPixelResultado> {
  const payload = await montarEventoGoogleAds(evento, params, config);
  if (!payload) return { ok: false, error: "conversion_action_nao_configurada" };

  const accessToken = await obterAccessTokenGoogle(config.refreshToken);
  if (!accessToken) return { ok: false, error: "oauth_token_indisponivel" };

  try {
    const res = await fetch("https://datamanager.googleapis.com/v1/events:ingest", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[pixel-google-ads] send_failed", JSON.stringify({ evento, status: res.status, body: body.slice(0, 300) }));
      return { ok: false, error: `http_${res.status}` };
    }

    return { ok: true };
  } catch (e) {
    console.error("[pixel-google-ads] request_error", JSON.stringify({ evento, message: (e as Error).message }));
    return { ok: false, error: "request_error" };
  }
}
