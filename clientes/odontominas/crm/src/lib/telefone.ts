/**
 * Semântica de telefone brasileiro compartilhada por quem lê o JID do
 * WhatsApp (`evolution-webhook.ts:normalizeTelefone`) e por quem lê input
 * digitado por humano (`chat.ts:normalizarTelefoneEntrada`) — um lugar só
 * decide a regra do 9º dígito, pra não divergir entre os dois caminhos.
 *
 * Regra (plano de numeração ANATEL — não "se tiver 8 dígitos soma 9"):
 * depois de DDI 55 + DDD (2 dígitos), fixo brasileiro começa em 2-5 e tem
 * 8 dígitos — nunca ganha 9º dígito; celular começa em 6-9 no número local,
 * com ou sem o 9 já presente (a faixa 6-9 é a mesma antes e depois da regra
 * de 2016 — o 9 é só um prefixo redundante). Só mexe quando: DDI é 55, sobra
 * DDD (2 dígitos) + exatamente 8 dígitos locais, e esse local começa em 6-9.
 * Número estrangeiro (não começa com 55) e fixo (local começa 2-5) nunca são
 * tocados.
 */

const DDI_BRASIL = "55";

function partesBr(digitos: string): { ddd: string; local: string } | null {
  if (!digitos.startsWith(DDI_BRASIL)) return null;
  const resto = digitos.slice(DDI_BRASIL.length);
  if (resto.length !== 10 && resto.length !== 11) return null;
  return { ddd: resto.slice(0, 2), local: resto.slice(2) };
}

function ehCelularSemNono(local: string): boolean {
  return local.length === 8 && /^[6-9]/.test(local);
}

function ehCelularComNono(local: string): boolean {
  return local.length === 9 && /^9[6-9]/.test(local);
}

/** Insere o 9º dígito que falta num celular BR; fixo/estrangeiro/já-canônico saem intactos. */
export function canonicalizarTelefoneBr(digitos: string): string {
  const partes = partesBr(digitos);
  if (!partes || !ehCelularSemNono(partes.local)) return digitos;
  return `${DDI_BRASIL}${partes.ddd}9${partes.local}`;
}

/**
 * Formas equivalentes de um telefone BR já canônico — usado só pra
 * encontrar um registro LEGADO já gravado sem o 9º dígito (nunca pra
 * aproximar telefones diferentes: DDI/DDD idênticos, só a presença do 9
 * muda). Sempre inclui a própria entrada. Fixo e estrangeiro nunca ganham
 * variante.
 */
export function variantesEquivalentesTelefoneBr(telefoneCanonico: string): string[] {
  const partes = partesBr(telefoneCanonico);
  if (!partes || !ehCelularComNono(partes.local)) return [telefoneCanonico];
  const semNono = `${DDI_BRASIL}${partes.ddd}${partes.local.slice(1)}`;
  return [telefoneCanonico, semNono];
}

/**
 * Dado um conjunto de candidatos já buscados por telefone equivalente
 * (`.in("telefone", variantesEquivalentesTelefoneBr(canonico))`), escolhe
 * determinística: prioriza o que já está gravado na forma canônica; sem
 * isso, o primeiro candidato (nunca fuzzy match, nunca aproxima telefones
 * diferentes — os candidatos já vieram filtrados pela query). Pura, sem
 * I/O, mesmo critério de `controle-odonto/patients.ts:encontrarCorrespondenciaPaciente`.
 */
export function encontrarPorTelefoneEquivalente<T extends { telefone: string | null }>(
  candidatos: T[],
  telefoneCanonico: string
): T | null {
  if (candidatos.length === 0) return null;
  return candidatos.find((c) => c.telefone === telefoneCanonico) ?? candidatos[0];
}
