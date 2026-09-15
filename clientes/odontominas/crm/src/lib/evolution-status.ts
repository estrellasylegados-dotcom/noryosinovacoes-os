/**
 * Status de conexão do WhatsApp (Evolution API) e QR Code pra reconectar —
 * mostrado na barra lateral (bolinha) e na página /conexao (só admin).
 * Mesma instância/env vars de evolution-send.ts. Nunca deixa uma falha de
 * rede travar a página: timeout curto, erro sempre vira um campo `erro`
 * amigável, nunca uma exceção não tratada subindo pro Server Component.
 */

const INSTANCE = process.env.EVOLUTION_INSTANCE || "odontominas-teste";
const TIMEOUT_MS = 4000;

function headersEvolution(apiKey: string): HeadersInit {
  return { apikey: apiKey, "Content-Type": "application/json" };
}

/** "5561999999999@s.whatsapp.net" → "5561999999999". Aceita já-só-dígitos também. */
function extrairNumeroDeJid(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const digitos = valor.split("@")[0]?.replace(/\D/g, "");
  return digitos || null;
}

export type StatusConexao = {
  /** null = não configurado neste ambiente, ou não foi possível verificar agora. */
  conectado: boolean | null;
  numero: string | null;
  erro?: string;
};

export async function buscarStatusConexao(): Promise<StatusConexao> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!apiUrl || !apiKey) return { conectado: null, numero: null, erro: "nao_configurado" };

  try {
    const res = await fetch(`${apiUrl}/instance/connectionState/${INSTANCE}`, {
      headers: headersEvolution(apiKey),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { conectado: null, numero: null, erro: `http_${res.status}` };

    const corpo = (await res.json().catch(() => null)) as { instance?: { state?: string } } | null;
    const conectado = corpo?.instance?.state === "open";

    return { conectado, numero: conectado ? await buscarNumeroConectado(apiUrl, apiKey) : null };
  } catch (e) {
    console.error("[evolution-status] request_error", JSON.stringify({ message: (e as Error).message }));
    return { conectado: null, numero: null, erro: "request_error" };
  }
}

/** Best-effort: o formato de resposta varia por versão da Evolution API — tenta os campos mais comuns e desiste em silêncio se não achar. */
async function buscarNumeroConectado(apiUrl: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiUrl}/instance/fetchInstances?instanceName=${INSTANCE}`, {
      headers: headersEvolution(apiKey),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const corpo = (await res.json().catch(() => null)) as unknown;
    const lista = Array.isArray(corpo) ? corpo : [corpo];
    const item = lista[0] as Record<string, unknown> | null | undefined;
    if (!item) return null;

    const instanceObj = (item.instance as Record<string, unknown> | undefined) ?? item;
    const candidato =
      (instanceObj.number as string | undefined) ??
      (instanceObj.owner as string | undefined) ??
      (instanceObj.ownerJid as string | undefined) ??
      null;

    return extrairNumeroDeJid(candidato);
  } catch {
    return null;
  }
}

export type QrResultado = {
  conectado: boolean;
  qrDataUrl: string | null;
  erro?: string;
};

export async function buscarQrCode(): Promise<QrResultado> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!apiUrl || !apiKey) return { conectado: false, qrDataUrl: null, erro: "nao_configurado" };

  try {
    const res = await fetch(`${apiUrl}/instance/connect/${INSTANCE}`, {
      headers: headersEvolution(apiKey),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { conectado: false, qrDataUrl: null, erro: `http_${res.status}` };

    const corpo = (await res.json().catch(() => null)) as
      | { base64?: string; instance?: { state?: string } }
      | null;

    if (corpo?.base64) return { conectado: false, qrDataUrl: corpo.base64 };
    if (corpo?.instance?.state === "open") return { conectado: true, qrDataUrl: null };
    return { conectado: false, qrDataUrl: null, erro: "sem_qr" };
  } catch (e) {
    console.error("[evolution-status] qr_error", JSON.stringify({ message: (e as Error).message }));
    return { conectado: false, qrDataUrl: null, erro: "request_error" };
  }
}
