import { getSupabaseServerClient } from "@/lib/supabase";
import { enviarEventoFacebook, type EventoPixel } from "@/lib/pixel-facebook";
import { enviarEventoGoogleAds } from "@/lib/pixel-google-ads";
import type { AgenteIA } from "@/lib/agentes";

/**
 * "Pixel de Conversão" (aba nova do print da RoiZap, deixada de fora até o
 * tráfego pago começar — ver decisão 2026-09-16 em `_memoria/decisoes.md`).
 * Critério fechado com o Rafael: 3 eventos do funil — `novo_lead` (1ª
 * mensagem de um contato), `lead_quente` (Qualificação Automática classifica
 * "Quente"), `agendado` (status vira "Agendado", a conversão principal nas
 * duas plataformas) — cada um disparado pra Facebook Conversions API
 * (pixel-facebook.ts) e Google Ads Data Manager API (pixel-google-ads.ts),
 * nunca mais de uma vez por conversa.
 *
 * `dispararPixelSeConfigurado` é chamada de 3 lugares — `responderComoAgente`
 * (novo_lead, lead_quente — src/lib/agentes.ts) e `atualizarStatus`
 * (agendado — src/lib/conversas.ts) — sempre isolada em try/catch por quem
 * chama, nunca pode derrubar o envio da mensagem nem a troca de status que
 * já aconteceu antes dela (mesmo padrão de `notificarEquipe`/qualificação).
 */

export type { EventoPixel } from "@/lib/pixel-facebook";

const COLUNA_ENVIADO_POR_EVENTO: Record<EventoPixel, string> = {
  novo_lead: "pixel_novo_lead_enviado_em",
  lead_quente: "pixel_quente_enviado_em",
  agendado: "pixel_agendado_enviado_em",
};

export type AgentePixelConfig = Pick<
  AgenteIA,
  | "pixelAtivo"
  | "pixelFacebookPixelId"
  | "pixelFacebookAccessToken"
  | "pixelGoogleCustomerId"
  | "pixelGoogleLoginCustomerId"
  | "pixelGoogleRefreshToken"
  | "pixelGoogleConversionActionNovoLead"
  | "pixelGoogleConversionActionQuente"
  | "pixelGoogleConversionActionAgendado"
>;

/**
 * "Trava" o disparo deste evento pra esta conversa com um UPDATE condicional
 * (`where coluna is null`) — atômico no Postgres, cobre a corrida rara de
 * duas chamadas simultâneas pro mesmo evento/conversa. `true` só quando esta
 * chamada foi a primeira a marcar a coluna (então é ela quem deve enviar).
 */
async function tentarReservarEnvio(clinicaId: string, conversaId: string, evento: EventoPixel): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return false;

  const coluna = COLUNA_ENVIADO_POR_EVENTO[evento];
  const { data, error } = await supabase
    .from("conversas")
    .update({ [coluna]: new Date().toISOString() })
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId)
    .is(coluna, null)
    .select("id");

  if (error) {
    console.error("[agentes-pixel] reservar_failed", JSON.stringify({ conversaId, evento, code: error.code ?? null }));
    return false;
  }

  return (data?.length ?? 0) > 0;
}

export async function dispararPixelSeConfigurado(
  agente: AgentePixelConfig,
  evento: EventoPixel,
  clinicaId: string,
  conversaId: string,
  telefone: string
): Promise<void> {
  if (!agente.pixelAtivo) return;

  const reservou = await tentarReservarEnvio(clinicaId, conversaId, evento);
  if (!reservou) return; // já disparado antes pra esta conversa/evento

  const params = { conversaId, telefone };
  const envios: Promise<{ ok: boolean; error?: string }>[] = [];

  if (agente.pixelFacebookPixelId && agente.pixelFacebookAccessToken) {
    envios.push(
      enviarEventoFacebook(
        { pixelId: agente.pixelFacebookPixelId, accessToken: agente.pixelFacebookAccessToken },
        evento,
        params
      )
    );
  }

  if (agente.pixelGoogleCustomerId && agente.pixelGoogleRefreshToken) {
    envios.push(
      enviarEventoGoogleAds(
        {
          customerId: agente.pixelGoogleCustomerId,
          loginCustomerId: agente.pixelGoogleLoginCustomerId,
          refreshToken: agente.pixelGoogleRefreshToken,
          conversionActionIdPorEvento: {
            novo_lead: agente.pixelGoogleConversionActionNovoLead ?? undefined,
            lead_quente: agente.pixelGoogleConversionActionQuente ?? undefined,
            agendado: agente.pixelGoogleConversionActionAgendado ?? undefined,
          },
        },
        evento,
        params
      )
    );
  }

  const resultados = await Promise.allSettled(envios);
  for (const resultado of resultados) {
    if (resultado.status === "fulfilled" && !resultado.value.ok) {
      console.error("[agentes-pixel] envio_falhou", JSON.stringify({ conversaId, evento, error: resultado.value.error ?? null }));
    } else if (resultado.status === "rejected") {
      console.error("[agentes-pixel] envio_rejeitado", JSON.stringify({ conversaId, evento, message: String(resultado.reason) }));
    }
  }
}

// ---------------------------------------------------------------------------
// Atribuição do lead (webhook)
// ---------------------------------------------------------------------------

type MessageContent = Record<string, unknown> | null | undefined;

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export type AtribuicaoLead = { origemLead: string | null };

/**
 * Melhor-esforço, sem garantia: o Baileys (protocolo não-oficial do WhatsApp
 * Web que a Evolution API usa) não expõe `ctwa_clid` nem UTM/gclid/fbclid —
 * isso só existe na API oficial da Meta (Cloud API), e o site hoje manda pro
 * WhatsApp sem querystring de tracking. O único dado com alguma chance real
 * de vir do Baileys é `contextInfo.externalAdReplyInfo`, presente quando a
 * mensagem é uma resposta a um anúncio — mas nem toda versão/tipo de
 * mensagem carrega isso. Retorna `origemLead: null` sem achar nada; nunca
 * inventa dado de atribuição.
 */
export function extrairAtribuicaoWebhook(message: MessageContent): AtribuicaoLead {
  if (!message) return { origemLead: null };

  const blocos = [message, message.extendedTextMessage, message.imageMessage, message.videoMessage, message.documentMessage]
    .map(asRecord)
    .filter((b): b is Record<string, unknown> => Boolean(b));

  for (const bloco of blocos) {
    const contextInfo = asRecord(bloco.contextInfo);
    const adReply = asRecord(contextInfo?.externalAdReplyInfo);
    if (!adReply) continue;

    const origem = asString(adReply.sourceUrl) ?? asString(adReply.sourceId) ?? asString(adReply.title);
    if (origem) return { origemLead: origem };
  }

  return { origemLead: null };
}
