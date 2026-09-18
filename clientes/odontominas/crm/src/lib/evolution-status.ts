/**
 * Status de conexão do WhatsApp (Evolution API) e QR Code pra reconectar —
 * mostrado na barra lateral (bolinha) e na página /conexao (só admin).
 * Cada função recebe a instância do CANAL (src/lib/canais.ts) — nunca uma instância global. Nunca deixa uma falha de
 * rede travar a página: timeout curto, erro sempre vira um campo `erro`
 * amigável, nunca uma exceção não tratada subindo pro Server Component.
 */

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
  /** Nome de perfil do WhatsApp conectado (`profileName` da Evolution API) — não é o nome da clínica, é de quem está logado no aparelho. */
  nome: string | null;
  foto: string | null;
  /** Tipo de integração (ex.: "WHATSAPP-BAILEYS") — mostrado como contexto de que é conexão não-oficial. */
  integracao: string | null;
  criadaEm: string | null;
  erro?: string;
};

export async function buscarStatusConexao(instancia: string | null | undefined): Promise<StatusConexao> {
  const vazio: StatusConexao = { conectado: null, numero: null, nome: null, foto: null, integracao: null, criadaEm: null };

  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!apiUrl || !apiKey || !instancia) return { ...vazio, erro: "nao_configurado" };

  try {
    const res = await fetch(`${apiUrl}/instance/connectionState/${instancia}`, {
      headers: headersEvolution(apiKey),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ...vazio, erro: `http_${res.status}` };

    const corpo = (await res.json().catch(() => null)) as { instance?: { state?: string } } | null;
    const conectado = corpo?.instance?.state === "open";
    const detalhes = await buscarDetalhesInstancia(instancia, apiUrl, apiKey);

    return { ...vazio, ...detalhes, conectado, numero: conectado ? detalhes.numero : null };
  } catch (e) {
    console.error("[evolution-status] request_error", JSON.stringify({ message: (e as Error).message }));
    return { ...vazio, erro: "request_error" };
  }
}

type DetalhesInstancia = { numero: string | null; nome: string | null; foto: string | null; integracao: string | null; criadaEm: string | null };
const DETALHES_VAZIOS: DetalhesInstancia = { numero: null, nome: null, foto: null, integracao: null, criadaEm: null };

/** Best-effort: o formato de resposta varia por versão da Evolution API — tenta os campos mais comuns e desiste em silêncio se não achar. */
async function buscarDetalhesInstancia(instancia: string, apiUrl: string, apiKey: string): Promise<DetalhesInstancia> {
  try {
    const res = await fetch(`${apiUrl}/instance/fetchInstances?instanceName=${instancia}`, {
      headers: headersEvolution(apiKey),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return DETALHES_VAZIOS;

    const corpo = (await res.json().catch(() => null)) as unknown;
    const lista = Array.isArray(corpo) ? corpo : [corpo];
    const item = lista[0] as Record<string, unknown> | null | undefined;
    if (!item) return DETALHES_VAZIOS;

    // Versões diferentes da Evolution API respondem com os campos direto na raiz
    // ou aninhados em `instance` — aceita os dois formatos.
    const instanceObj = (item.instance as Record<string, unknown> | undefined) ?? item;
    const candidatoNumero =
      (instanceObj.number as string | undefined) ??
      (instanceObj.owner as string | undefined) ??
      (instanceObj.ownerJid as string | undefined) ??
      null;

    return {
      numero: extrairNumeroDeJid(candidatoNumero),
      nome: (instanceObj.profileName as string | undefined) ?? null,
      foto: (instanceObj.profilePicUrl as string | undefined) ?? null,
      integracao: (instanceObj.integration as string | undefined) ?? null,
      criadaEm: (instanceObj.createdAt as string | undefined) ?? null,
    };
  } catch {
    return DETALHES_VAZIOS;
  }
}

export type QrResultado = {
  conectado: boolean;
  qrDataUrl: string | null;
  erro?: string;
};

export async function buscarQrCode(instancia: string): Promise<QrResultado> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!apiUrl || !apiKey) return { conectado: false, qrDataUrl: null, erro: "nao_configurado" };

  try {
    const res = await fetch(`${apiUrl}/instance/connect/${instancia}`, {
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

/**
 * Encerra a sessão do WhatsApp conectado (equivalente a "sair" no app) —
 * a instância continua existindo na Evolution API, só precisa de um QR novo
 * pra reconectar. Ação séria de verdade (derruba o atendimento até
 * reconectar): a confirmação fica no botão que chama isto (src/components/RodapeInstancia.tsx),
 * não aqui — esta função só executa.
 */
export async function desconectarInstancia(instancia: string): Promise<{ ok: boolean; error?: string }> {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  if (!apiUrl || !apiKey) return { ok: false, error: "nao_configurado" };

  try {
    const res = await fetch(`${apiUrl}/instance/logout/${instancia}`, {
      method: "DELETE",
      headers: headersEvolution(apiKey),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[evolution-status] logout_failed", JSON.stringify({ status: res.status }));
      return { ok: false, error: `http_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[evolution-status] logout_error", JSON.stringify({ message: (e as Error).message }));
    return { ok: false, error: "request_error" };
  }
}
