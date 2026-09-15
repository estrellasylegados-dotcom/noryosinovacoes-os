import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Comparação em tempo constante de dois segredos simples (evita vazar, por
 * timing, quantos caracteres bateram — `===` normal para na 1ª diferença).
 * Usado onde o segredo é único e fixo, não por pessoa — hoje só CRON_SECRET
 * (src/app/api/cron/reativacao). Login por atendente usa hashSenha/
 * verificarSenha abaixo, não isto. Só pra runtime Node; não usar no
 * middleware (Edge).
 */
export function compararSenhas(informada: string, esperada: string | undefined | null): boolean {
  if (!esperada) return false;

  const a = Buffer.from(informada);
  const b = Buffer.from(esperada);
  const tamanho = Math.max(a.length, b.length, 1);
  const aPad = Buffer.concat([a, Buffer.alloc(tamanho - a.length)]);
  const bPad = Buffer.concat([b, Buffer.alloc(tamanho - b.length)]);

  return a.length === b.length && timingSafeEqual(aPad, bPad);
}

/**
 * Hash de senha por atendente (scrypt + salt aleatório, formato
 * `salt_hex:hash_hex`). Substitui a comparação de senha única em env var
 * (ver migração 2026-09-15_v4_equipe.sql) — cada atendente tem sua própria
 * conta agora.
 */

const KEYLEN = 64;

export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verificarSenha(informada: string, hashArmazenado: string | undefined | null): boolean {
  if (!hashArmazenado) return false;

  const [salt, hashHex] = hashArmazenado.split(":");
  if (!salt || !hashHex) return false;

  const hashEsperado = Buffer.from(hashHex, "hex");
  const hashInformado = scryptSync(informada, salt, hashEsperado.length);

  return hashInformado.length === hashEsperado.length && timingSafeEqual(hashInformado, hashEsperado);
}

/**
 * Hash de uma senha que não existe — usado no login pra rodar `verificarSenha`
 * mesmo quando o usuário informado não existe, senão a resposta de "usuário
 * não existe" chega mais rápido que "senha errada" e vaza, por tempo, quais
 * usuários são reais.
 */
export const HASH_DUMMY_TIMING =
  "cf650c5412a6bde04a4ac7fb4aff1e4f:79bcf2b01ae59b25b3fbc04b85c688ec07093a1b1fd1fb0203d702c18631cf8d9e78533e2794b0455385c2d09d4da7c67abd000f21ac93983c15335642f9d62a";
