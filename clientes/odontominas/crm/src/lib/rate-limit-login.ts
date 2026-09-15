/**
 * Freio simples contra força bruta no `/api/login`. As senhas hoje são as
 * temporárias de desenvolvimento (ver andamento.md) — sem isto, qualquer um
 * com a URL pública do Railway podia tentar senha sem limite nenhum.
 *
 * Em memória do processo, sem dependência nova: esta é uma instância única
 * no Railway (não um cluster), então não perde eficácia por não ser
 * compartilhado entre processos. Não sobrevive a restart/deploy — aceitável
 * pra este remendo (o objetivo é frear automação, não blindar contra um
 * atacante que reinicia o próprio alvo).
 */

const MAX_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000;

type Tentativa = { count: number; resetAt: number };
const tentativas = new Map<string, Tentativa>();

function sweep(now: number) {
  if (tentativas.size > 1000) {
    for (const [chave, t] of tentativas) if (t.resetAt <= now) tentativas.delete(chave);
  }
}

export function estaBloqueado(chave: string, now = Date.now()): { bloqueado: boolean; retryAfterSec?: number } {
  const t = tentativas.get(chave);
  if (!t || t.resetAt <= now) return { bloqueado: false };
  if (t.count >= MAX_TENTATIVAS) {
    return { bloqueado: true, retryAfterSec: Math.max(1, Math.ceil((t.resetAt - now) / 1000)) };
  }
  return { bloqueado: false };
}

export function registrarFalha(chave: string, now = Date.now()): void {
  sweep(now);
  const t = tentativas.get(chave);
  if (!t || t.resetAt <= now) {
    tentativas.set(chave, { count: 1, resetAt: now + JANELA_MS });
    return;
  }
  t.count += 1;
}

export function limparTentativas(chave: string): void {
  tentativas.delete(chave);
}

/** Só pros testes — zera o estado em memória entre casos. */
export function __resetEstadoRateLimit(): void {
  tentativas.clear();
}
