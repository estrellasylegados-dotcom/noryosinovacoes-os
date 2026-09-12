"use client";

import { RefObject, useEffect, useRef, useState } from "react";

/**
 * Base do motion system — hooks pequenos sobre IntersectionObserver. Nenhuma
 * dependência externa. A CSS global (`[data-anim]`) já neutraliza as
 * transições em prefers-reduced-motion; os hooks só evitam trabalho de JS
 * desnecessário quando o usuário pediu menos movimento.
 */

type InViewOptions = {
  /** Só dispara uma vez (padrão) — evita re-animar ao rolar pra cima. */
  once?: boolean;
  /**
   * Recuo do gatilho. O padrão dispara quando o topo do elemento sobe até
   * ~65% da viewport — a transição de entrada acontece dentro da tela, não
   * no rodapé um scroll inteiro antes de o usuário chegar. Em blocos mais
   * altos que a viewport, nunca usar `threshold` alto: a razão de
   * interseção não alcança o valor e a animação nunca dispara.
   */
  rootMargin?: string;
};

export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: InViewOptions = {}
): [RefObject<T | null>, boolean] {
  const { once = true, rootMargin = "0px 0px -35% 0px" } = options;
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold: 0, rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [once, rootMargin]);

  return [ref, inView];
}

/**
 * Parallax de scroll — desloca o elemento no eixo Y conforme ele cruza a
 * viewport (drift sutil). `strength` = amplitude total em px. Desligado em
 * reduced-motion. rAF só enquanto visível. Uso pontual: arte do hero.
 */
export function useParallax<T extends HTMLElement = HTMLDivElement>(
  strength = 36
): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let active = false;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // -1 (elemento abaixo da tela) .. 0 (centralizado) .. 1 (acima)
      const ratio = (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
      setOffset(-Math.max(-1.2, Math.min(1.2, ratio)) * strength);
      raf = active ? requestAnimationFrame(measure) : 0;
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        active = entry.isIntersecting;
        if (active && !raf) raf = requestAnimationFrame(measure);
      },
      { threshold: 0 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [strength]);

  return [ref, offset];
}
