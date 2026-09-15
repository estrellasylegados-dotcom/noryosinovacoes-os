import { timingSafeEqual } from "node:crypto";

/**
 * Compara senha em tempo constante (evita vazar, por timing, quantos
 * caracteres bateram — `===` normal para na primeira diferença). Só pra
 * runtime Node (`node:crypto`); não usar de dentro do middleware (Edge).
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
