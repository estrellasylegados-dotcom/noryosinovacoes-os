/**
 * Provedores de IA pros Agentes (src/lib/agentes.ts) — sem SDK novo, `fetch`
 * puro, mesmo espírito de evolution-send.ts. Três formatos de requisição,
 * não cinco: OpenAI/Groq/DeepSeek falam o mesmo formato "chat completions"
 * OpenAI-compatível; Gemini e Claude têm formato próprio.
 *
 * "Grátis" = camada gratuita do próprio provedor (Google AI Studio e Groq
 * Cloud dão chave sem cartão, com limite de uso) — não é uma chave da Noryos
 * embutida no código. Cada modelo só aparece disponível se a env var
 * correspondente estiver setada (ver .env.example); sem chave nenhuma, o
 * seletor fica vazio, mas a tela nunca quebra (mesmo espírito de "sem
 * fallback silencioso, mas sem derrubar a tela" do resto do projeto).
 *
 * IDs de modelo: confirmar o nome exato vigente em cada provedor antes de
 * girar isso pra produção — catálogo muda com frequência.
 */

export type ProvedorId = "google" | "groq" | "openai" | "anthropic" | "deepseek";

export type ModeloIA = {
  provider: ProvedorId;
  id: string;
  label: string;
  gratis: boolean;
  envVar: string;
};

export const CATALOGO_MODELOS: ModeloIA[] = [
  { provider: "google", id: "gemini-flash-lite-latest", label: "Gemini Flash-Lite", gratis: true, envVar: "GOOGLE_API_KEY" },
  { provider: "groq", id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)", gratis: true, envVar: "GROQ_API_KEY" },
  { provider: "openai", id: "gpt-4o-mini", label: "GPT-4o mini", gratis: false, envVar: "OPENAI_API_KEY" },
  { provider: "anthropic", id: "claude-haiku-4-5", label: "Claude Haiku 4.5", gratis: false, envVar: "ANTHROPIC_API_KEY" },
  { provider: "deepseek", id: "deepseek-chat", label: "DeepSeek Chat", gratis: false, envVar: "DEEPSEEK_API_KEY" },
];

/** Só os modelos cuja env var de API key está setada neste ambiente — nunca lista o que não vai funcionar. */
export function modelosDisponiveis(): ModeloIA[] {
  return CATALOGO_MODELOS.filter((m) => Boolean(process.env[m.envVar]));
}

export function buscarModelo(provider: string, id: string): ModeloIA | null {
  return CATALOGO_MODELOS.find((m) => m.provider === provider && m.id === id) ?? null;
}

export type MensagemHistorico = { direcao: "recebida" | "enviada"; texto: string };

export type OpcoesResposta = {
  promptSistema: string;
  historico: MensagemHistorico[];
  mensagem: string;
  temperatura: number;
  maxTokens: number;
};

export type RespostaIA = { ok: boolean; texto?: string; error?: string };

const TIMEOUT_MS = 15_000;

/** Gera a resposta do agente pro provedor configurado no modelo escolhido. Nunca lança — sempre RespostaIA. */
export async function gerarResposta(modelo: ModeloIA, opts: OpcoesResposta): Promise<RespostaIA> {
  const apiKey = process.env[modelo.envVar];
  if (!apiKey) return { ok: false, error: "chave_nao_configurada" };

  try {
    switch (modelo.provider) {
      case "google":
        return await chamarGemini(modelo.id, apiKey, opts);
      case "anthropic":
        return await chamarAnthropic(modelo.id, apiKey, opts);
      case "groq":
        return await chamarChatCompletions("https://api.groq.com/openai/v1", modelo.id, apiKey, opts);
      case "openai":
        return await chamarChatCompletions("https://api.openai.com/v1", modelo.id, apiKey, opts);
      case "deepseek":
        return await chamarChatCompletions("https://api.deepseek.com/v1", modelo.id, apiKey, opts);
    }
  } catch (e) {
    if ((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError") {
      console.error("[ia-provedores] timeout", JSON.stringify({ provider: modelo.provider }));
      return { ok: false, error: "timeout" };
    }
    console.error("[ia-provedores] request_error", JSON.stringify({ provider: modelo.provider, message: (e as Error).message }));
    return { ok: false, error: "request_error" };
  }
}

function mapMensagensOpenAI(opts: OpcoesResposta) {
  return [
    { role: "system" as const, content: opts.promptSistema },
    ...opts.historico.map((m) => ({ role: m.direcao === "enviada" ? ("assistant" as const) : ("user" as const), content: m.texto })),
    { role: "user" as const, content: opts.mensagem },
  ];
}

/** OpenAI, Groq e DeepSeek falam o mesmo formato "chat completions". */
async function chamarChatCompletions(baseUrl: string, modeloId: string, apiKey: string, opts: OpcoesResposta): Promise<RespostaIA> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modeloId,
      messages: mapMensagensOpenAI(opts),
      temperature: opts.temperatura,
      max_tokens: opts.maxTokens,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[ia-provedores] chat_completions_failed", JSON.stringify({ baseUrl, status: res.status, body: body.slice(0, 200) }));
    return { ok: false, error: `http_${res.status}` };
  }

  const corpo = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const texto = corpo?.choices?.[0]?.message?.content?.trim();
  if (!texto) return { ok: false, error: "resposta_vazia" };
  return { ok: true, texto };
}

async function chamarGemini(modeloId: string, apiKey: string, opts: OpcoesResposta): Promise<RespostaIA> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modeloId}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.promptSistema }] },
      contents: [
        ...opts.historico.map((m) => ({ role: m.direcao === "enviada" ? "model" : "user", parts: [{ text: m.texto }] })),
        { role: "user", parts: [{ text: opts.mensagem }] },
      ],
      generationConfig: { temperature: opts.temperatura, maxOutputTokens: opts.maxTokens },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[ia-provedores] gemini_failed", JSON.stringify({ status: res.status, body: body.slice(0, 200) }));
    return { ok: false, error: `http_${res.status}` };
  }

  const corpo = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } | null;
  const texto = corpo?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!texto) return { ok: false, error: "resposta_vazia" };
  return { ok: true, texto };
}

async function chamarAnthropic(modeloId: string, apiKey: string, opts: OpcoesResposta): Promise<RespostaIA> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modeloId,
      system: opts.promptSistema,
      messages: [
        ...opts.historico.map((m) => ({ role: m.direcao === "enviada" ? "assistant" : "user", content: m.texto })),
        { role: "user", content: opts.mensagem },
      ],
      max_tokens: opts.maxTokens,
      temperature: opts.temperatura,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[ia-provedores] anthropic_failed", JSON.stringify({ status: res.status, body: body.slice(0, 200) }));
    return { ok: false, error: `http_${res.status}` };
  }

  const corpo = (await res.json().catch(() => null)) as { content?: { text?: string }[] } | null;
  const texto = corpo?.content?.[0]?.text?.trim();
  if (!texto) return { ok: false, error: "resposta_vazia" };
  return { ok: true, texto };
}
