/**
 * Facebook/Meta Conversions API — a pedido do Rafael (print da RoiZap,
 * aba Pixel dos Agentes de IA, deixada de fora até o tráfego pago começar —
 * ver decisão 2026-09-16 em `_memoria/decisoes.md`). Envio server-side, não
 * pixel de navegador: aqui não existe página nem sessão de browser, é uma
 * conversa de WhatsApp — `action_source: "business_messaging"` é o valor
 * documentado pra evento de mensageria (não `website`/`app`).
 *
 * Hash com Web Crypto (`crypto.subtle`), não `node:crypto` — mesmo motivo de
 * `sessao.ts`: este arquivo entra na cadeia de import de `conversas.ts`
 * (chamado da troca de status), que o Next também bundla pro lado do
 * cliente via `chat.ts`/`ChatAoVivo.tsx` — `node:crypto` quebra esse build.
 *
 * `montarEventoFacebook` é pura e testável (mesmo padrão de
 * `parseClassificacao` em agentes-qualificacao.ts); `enviarEventoFacebook` é
 * o `fetch` de verdade, nunca lança — loga e engole erro, chamado só depois
 * do dedup (src/lib/agentes-pixel.ts) já ter garantido que este evento não
 * saiu antes pra esta conversa.
 *
 * `event_id` = `{conversaId}:{evento}` também deduplica do lado da Meta
 * (defesa em profundidade, além do dedup no nosso banco).
 *
 * Campo pouco documentado na pesquisa (docs.developers.facebook.com não
 * confirmou explicitamente o schema completo de `messaging_channel` pra
 * business_messaging) — validar contra o Events Manager de verdade assim
 * que o Rafael tiver um Pixel real conectado; não deve quebrar o envio se
 * estiver errado (Meta ignora campo desconhecido), só não deve ser tratado
 * como 100% garantido até essa validação.
 */

export type EventoPixel = "novo_lead" | "lead_quente" | "agendado";

const EVENT_NAME_POR_EVENTO: Record<EventoPixel, string> = {
  novo_lead: "Lead",
  lead_quente: "LeadQualificado",
  agendado: "Schedule",
};

export type ParametrosEventoPixel = {
  conversaId: string;
  /** Só dígitos, com DDI — mesmo formato que `normalizeTelefone` (evolution-webhook.ts) já produz. */
  telefone: string;
};

export type ConfigFacebookPixel = {
  pixelId: string;
  accessToken: string;
};

export type PayloadFacebook = {
  data: Array<{
    event_name: string;
    event_time: number;
    event_id: string;
    action_source: "business_messaging";
    messaging_channel: "whatsapp";
    user_data: { ph: string[] };
  }>;
};

/** SHA-256 hex — mesma exigência de hashing da Meta pra todo campo de `user_data`. */
export async function hashSha256(valor: string): Promise<string> {
  const dados = new TextEncoder().encode(valor.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function montarEventoFacebook(
  evento: EventoPixel,
  params: ParametrosEventoPixel,
  agora: Date = new Date()
): Promise<PayloadFacebook> {
  return {
    data: [
      {
        event_name: EVENT_NAME_POR_EVENTO[evento],
        event_time: Math.floor(agora.getTime() / 1000),
        event_id: `${params.conversaId}:${evento}`,
        action_source: "business_messaging",
        messaging_channel: "whatsapp",
        user_data: { ph: [await hashSha256(params.telefone)] },
      },
    ],
  };
}

export type EnvioPixelResultado = { ok: boolean; error?: string };

const VERSAO_API = "v21.0";

export async function enviarEventoFacebook(
  config: ConfigFacebookPixel,
  evento: EventoPixel,
  params: ParametrosEventoPixel
): Promise<EnvioPixelResultado> {
  try {
    const payload = await montarEventoFacebook(evento, params);
    const url = `https://graph.facebook.com/${VERSAO_API}/${config.pixelId}/events?access_token=${encodeURIComponent(config.accessToken)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[pixel-facebook] send_failed", JSON.stringify({ evento, status: res.status, body: body.slice(0, 300) }));
      return { ok: false, error: `http_${res.status}` };
    }

    return { ok: true };
  } catch (e) {
    console.error("[pixel-facebook] request_error", JSON.stringify({ evento, message: (e as Error).message }));
    return { ok: false, error: "request_error" };
  }
}
