/**
 * Cliente de saída da Evolution API — envia mensagem de texto pelo WhatsApp
 * da instância do CRM. Contraparte do webhook (src/app/api/webhook/evolution),
 * que só recebe; este é o único ponto do código que inicia uma mensagem (hoje,
 * só a automação de reativação — src/lib/reativacao.ts). Mesma instância do
 * webhook, mesmo padrão de env var do scripts/set-webhook.mjs.
 */

const INSTANCE = process.env.EVOLUTION_INSTANCE || "odontominas-teste";

export type EnvioResultado = { ok: boolean; error?: string; mensagemId?: string | null };

export async function enviarMensagemWhatsapp(telefone: string, texto: string): Promise<EnvioResultado> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!apiUrl || !apiKey) return { ok: false, error: "evolution_unavailable" };

  try {
    const res = await fetch(`${apiUrl}/message/sendText/${INSTANCE}`, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ number: telefone, text: texto }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        "[evolution-send] send_failed",
        JSON.stringify({ status: res.status, body: body.slice(0, 200) })
      );
      return { ok: false, error: `http_${res.status}` };
    }

    const corpo = (await res.json().catch(() => null)) as { key?: { id?: string } } | null;
    return { ok: true, mensagemId: corpo?.key?.id ?? null };
  } catch (e) {
    console.error("[evolution-send] request_error", JSON.stringify({ message: (e as Error).message }));
    return { ok: false, error: "request_error" };
  }
}
