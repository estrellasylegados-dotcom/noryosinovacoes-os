/**
 * Cliente de saída da Evolution API — baixo nível: manda um texto por UMA
 * instância. Não decide qual instância usar: quem decide é o canal
 * (src/lib/canais-envio.ts resolve conversa → canal → instância), nunca uma
 * env var global. Todo código de aplicação chama `canais-envio.ts`, não este
 * arquivo direto.
 */

export type EnvioResultado = { ok: boolean; error?: string; mensagemId?: string | null };

export async function enviarTextoEvolution(
  instancia: string,
  telefone: string,
  texto: string,
  apiKeyCanal?: string | null
): Promise<EnvioResultado> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = apiKeyCanal || process.env.EVOLUTION_API_KEY;
  if (!apiUrl || !apiKey) return { ok: false, error: "evolution_unavailable" };

  try {
    const res = await fetch(`${apiUrl}/message/sendText/${encodeURIComponent(instancia)}`, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
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
