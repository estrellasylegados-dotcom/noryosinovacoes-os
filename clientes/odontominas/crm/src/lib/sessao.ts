/**
 * Sessão do painel (ver andamento.md): 1 conta por atendente (tabela
 * `atendentes`, migração 2026-09-15_v4_equipe), sem Supabase Auth — cookie
 * assinado carrega quem logou (id + nome + papel), não só o papel genérico
 * de antes. É o que permite atribuir "quem atendeu" no funil (src/lib/conversas.ts)
 * e agregar por secretária na Equipe (src/lib/equipe.ts).
 *
 * Usa Web Crypto (crypto.subtle) em vez do módulo `node:crypto` de propósito:
 * este arquivo é importado pelo middleware, que roda em runtime Edge.
 */

export type Papel = "admin" | "atendente";

export type SessaoAtual = { atendenteId: string; nome: string; papel: Papel };

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

function isPapelValido(v: string): v is Papel {
  return v === "admin" || v === "atendente";
}

export async function criarTokenSessao(atendenteId: string, nome: string, papel: Papel): Promise<string> {
  const expiraEm = Date.now() + DURACAO_SESSAO_MS;
  const nomeCodificado = paraBase64Url(new TextEncoder().encode(nome));
  const payload = `${papel}:${atendenteId}:${nomeCodificado}:${expiraEm}`;
  const chave = await getChave();
  const assinatura = await crypto.subtle.sign(ALGORITMO, chave, new TextEncoder().encode(payload));
  return `${payload}.${paraBase64Url(assinatura)}`;
}

export async function lerSessao(token: string | undefined | null): Promise<SessaoAtual | null> {
  if (!token) return null;

  const ultimoPonto = token.lastIndexOf(".");
  if (ultimoPonto === -1) return null;

  const payload = token.slice(0, ultimoPonto);
  const assinaturaBase64 = token.slice(ultimoPonto + 1);

  const partes = payload.split(":");
  if (partes.length !== 4) return null;
  const [papel, atendenteId, nomeCodificado, expiraEmStr] = partes;
  if (!isPapelValido(papel) || !atendenteId) return null;

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

  let nome: string;
  try {
    nome = new TextDecoder().decode(deBase64Url(nomeCodificado));
  } catch {
    return null;
  }

  return { atendenteId, nome, papel };
}
