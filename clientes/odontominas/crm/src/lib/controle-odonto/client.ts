import { getControleOdontoConfig, type ControleOdontoConfig } from "./config";
import { getAuthProvider, type ControleOdontoAuthProvider } from "./auth";
import { ControleOdontoHttpError, ControleOdontoTimeoutError, ehStatusRetentavel } from "./errors";

const TIMEOUT_PADRAO_MS = 10_000;
const TENTATIVAS_PADRAO = 3;
const BACKOFF_BASE_MS = 1000;

function calcularBackoffMs(tentativa: number): number {
  const base = BACKOFF_BASE_MS * 2 ** (tentativa - 1);
  const jitter = base * 0.2 * (Math.random() * 2 - 1); // ±20%
  return Math.max(0, Math.round(base + jitter));
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ehErroDeTimeoutOuAbort(erro: unknown): boolean {
  const nome = (erro as { name?: string } | null)?.name;
  return nome === "TimeoutError" || nome === "AbortError";
}

export interface ControleOdontoRequestOptions {
  timeoutMs?: number;
  maxTentativas?: number;
  query?: Record<string, string>;
}

/**
 * GET autenticado com timeout (8–12s), retry em 429/500/502/503/504/timeout
 * e backoff exponencial com jitter — nunca repete 400/401/403/404 (ver
 * pedido, seção RESILIÊNCIA). Só GET existe hoje: nenhuma operação de
 * escrita está confirmada (ver capabilities.ts). Quando existir, entra como
 * método próprio — retry automático numa escrita não-idempotente é
 * perigoso, então cada escrita futura decide seu próprio comportamento.
 *
 * `config`/`auth` são injetáveis só pra teste; em produção usam sempre os
 * defaults (env vars reais / provider ainda não confirmado).
 */
export async function getControleOdonto<T>(
  path: string,
  options: ControleOdontoRequestOptions = {},
  config: ControleOdontoConfig = getControleOdontoConfig(),
  auth: ControleOdontoAuthProvider = getAuthProvider()
): Promise<T> {
  if (!config.baseUrl) throw new Error("controle_odonto_base_url_ausente");

  const timeoutMs = options.timeoutMs ?? TIMEOUT_PADRAO_MS;
  const maxTentativas = options.maxTentativas ?? TENTATIVAS_PADRAO;
  const url = new URL(path, config.baseUrl);
  if (options.query) {
    for (const [chave, valor] of Object.entries(options.query)) url.searchParams.set(chave, valor);
  }

  let ultimoErro: unknown;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      const init = auth.aplicarAutenticacao({ method: "GET", signal: AbortSignal.timeout(timeoutMs) });
      const resposta = await fetch(url, init);

      if (!resposta.ok) {
        if (ehStatusRetentavel(resposta.status) && tentativa < maxTentativas) {
          await esperar(calcularBackoffMs(tentativa));
          continue;
        }
        throw new ControleOdontoHttpError(resposta.status);
      }

      return (await resposta.json()) as T;
    } catch (erro) {
      ultimoErro = erro;

      if (erro instanceof ControleOdontoHttpError) throw erro;

      if (ehErroDeTimeoutOuAbort(erro)) {
        if (tentativa < maxTentativas) {
          await esperar(calcularBackoffMs(tentativa));
          continue;
        }
        throw new ControleOdontoTimeoutError();
      }

      // Erro de rede genérico (fetch rejeitou por outro motivo): mesma
      // política de retry do timeout, até esgotar as tentativas.
      if (tentativa < maxTentativas) {
        await esperar(calcularBackoffMs(tentativa));
        continue;
      }
      throw erro;
    }
  }

  throw ultimoErro instanceof Error ? ultimoErro : new Error("controle_odonto_falha_desconhecida");
}
