import type { CSSProperties } from "react";

/**
 * Motion system central — os padrões nomeados do §34 do briefing.
 * Os valores de duração/easing moram em globals.css (tokens --dur-* /
 * --ease-*). Aqui ficam só os nomes de animação de entrada usados via
 * `data-anim` e o helper de stagger. Nada de número de animação espalhado
 * pelos componentes.
 */

export type AnimName =
  | "fade-up"
  | "fade"
  | "fade-left"
  | "fade-right"
  | "scale-in"
  | "slide-reveal";

/** Delay de stagger por índice (ms) — o CSS lê `--i`. Cap pra não arrastar. */
export const STAGGER_STEP = 70;
export const STAGGER_CAP = 6;

/** style={staggerIndex(i)} num filho de um container [data-stagger]. */
export function staggerIndex(i: number): CSSProperties {
  return { "--i": Math.min(i, STAGGER_CAP) } as CSSProperties;
}

/** Atraso pontual pra uma entrada isolada (sem container de stagger). */
export function animDelay(ms: number): CSSProperties {
  return { "--anim-delay": `${ms}ms` } as CSSProperties;
}
