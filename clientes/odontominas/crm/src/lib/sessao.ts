/**
 * Remendo mínimo de acesso (ver andamento.md, decisão 2026-09-15): 2 senhas
 * compartilhadas (admin/atendente), sem tabela de usuário nem Supabase Auth.
 * Fecha a exposição da URL pública; RBAC de verdade (permissão diferenciada
 * por perfil) fica pra depois que o piloto validar — hoje as duas roles têm
 * a mesma capacidade no painel, então só carregam o papel pra sessão futura
 * não precisar redesenhar o login.
 *
 * Usa Web Crypto (crypto.subtle) em vez do módulo `node:crypto` de propósito:
 * este arquivo é importado pelo middleware, que roda em runtime Edge.
 */

export type Papel = "admin" | "atendente";

export const NOME_COOKIE_SESSAO = "crm_sessao";

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

function paraBase64Url(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
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

function isPapelValido(v: string): v is Papel {
  return v === "admin" || v === "atendente";
}

export async function criarTokenSessao(papel: Papel): Promise<string> {
  const expiraEm = Date.now() + DURACAO_SESSAO_MS;
  const payload = `${papel}:${expiraEm}`;
  const chave = await getChave();
  const assinatura = await crypto.subtle.sign(ALGORITMO, chave, new TextEncoder().encode(payload));
  return `${payload}.${paraBase64Url(assinatura)}`;
}

export async function lerSessao(token: string | undefined | null): Promise<{ papel: Papel } | null> {
  if (!token) return null;

  const ultimoPonto = token.lastIndexOf(".");
  if (ultimoPonto === -1) return null;

  const payload = token.slice(0, ultimoPonto);
  const assinaturaBase64 = token.slice(ultimoPonto + 1);

  const [papel, expiraEmStr] = payload.split(":");
  if (!isPapelValido(papel)) return null;

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
  if (!Number.isFinite(expiraEm) || Date.now() > expiraEm) return null;

  return { papel };
}
