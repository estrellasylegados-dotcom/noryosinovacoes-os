/**
 * Camada Edge-safe da sessão (ver andamento.md e docs/RBAC.md, fase
 * Identidade/RBAC 2026-09-18). O cookie carrega só o mínimo assinado —
 * atendenteId, versão de sessão e validade — nunca perfil/permissões:
 * quem decide o que a pessoa pode fazer é sempre uma leitura fresca no
 * banco (src/lib/sessao-servidor.ts), nunca um valor cacheado no token.
 * Isso é o que permite bloqueio e mudança de permissão surtirem efeito
 * imediato (seção 56/69/70 do pedido), sem esperar o token expirar.
 *
 * `sessaoVersao` é o mecanismo de revogação: bloquear/desativar/resetar
 * senha/"encerrar sessões" incrementa `atendentes.sessao_versao` — todo
 * token emitido antes disso passa a divergir e é rejeitado (ver
 * getSessaoAtual). Não guarda sessão por dispositivo (isso exigiria uma
 * tabela de sessões por token, não implementada nesta fase); dá pra
 * "encerrar tudo" de uma vez, não "encerrar só o Chrome/Android".
 *
 * Usa Web Crypto (crypto.subtle) em vez do módulo `node:crypto` de
 * propósito: este arquivo é importado pelo middleware, que roda em runtime
 * Edge.
 */

export const NOME_COOKIE_SESSAO = "crm_sessao";

export type TokenSessao = { atendenteId: string; sessaoVersao: number; expiraEm: number };

const ALGORITMO = { name: "HMAC", hash: "SHA-256" };
const DURACAO_SESSAO_MS = 12 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.SESSAO_SECRET;
  if (!secret) throw new Error("SESSAO_SECRET não configurado");
  return secret;
}

async function getChave(): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(getSecret());
  return crypto.subtle.importKey("raw", keyData, ALGORITMO, false, ["sign", "verify"]);
}

function paraBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binario = "";
  for (const b of arr) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const normalizado = s.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalizado.length % 4)) % 4;
  const binario = atob(normalizado + "=".repeat(padding));
  const arr = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) arr[i] = binario.charCodeAt(i);
  return arr;
}

export async function criarTokenSessao(atendenteId: string, sessaoVersao: number): Promise<string> {
  const expiraEm = Date.now() + DURACAO_SESSAO_MS;
  const payload = `${atendenteId}:${sessaoVersao}:${expiraEm}`;
  const chave = await getChave();
  const assinatura = await crypto.subtle.sign(ALGORITMO, chave, new TextEncoder().encode(payload));
  return `${payload}.${paraBase64Url(assinatura)}`;
}

/** Só valida assinatura/formato/validade — não confirma que a conta ainda existe/está ativa (isso é getSessaoAtual, que lê o banco). */
export async function lerTokenSessao(token: string | undefined | null): Promise<TokenSessao | null> {
  if (!token) return null;

  const ultimoPonto = token.lastIndexOf(".");
  if (ultimoPonto === -1) return null;

  const payload = token.slice(0, ultimoPonto);
  const assinaturaBase64 = token.slice(ultimoPonto + 1);

  const partes = payload.split(":");
  if (partes.length !== 3) return null;
  const [atendenteId, sessaoVersaoStr, expiraEmStr] = partes;
  if (!atendenteId) return null;

  try {
    const chave = await getChave();
    const valido = await crypto.subtle.verify(
      ALGORITMO,
      chave,
      deBase64Url(assinaturaBase64),
      new TextEncoder().encode(payload)
    );
    if (!valido) return null;
  } catch {
    return null;
  }

  const expiraEm = Number(expiraEmStr);
  const sessaoVersao = Number(sessaoVersaoStr);
  if (!Number.isFinite(expiraEm) || Date.now() > expiraEm) return null;
  if (!Number.isFinite(sessaoVersao)) return null;

  return { atendenteId, sessaoVersao, expiraEm };
}
