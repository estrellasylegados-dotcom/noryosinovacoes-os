"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

/**
 * Confirma que uma seção entrou na tela — não decora, só evita que tudo
 * apareça "estático" de uma vez. Respeita prefers-reduced-motion via CSS
 * global (ver globals.css), então não precisa checar isso em JS aqui.
 *
 * `delay` (ms) permite escalonar itens de uma mesma lista/grid sem exagero
 * (ex: delay={i * 60}). `as` troca a tag raiz quando o wrapper precisa ser
 * <li>, <ol> etc. em vez de <div>.
 */
type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "ol" | "ul" | "section";
};

export function Reveal({ children, className = "", delay = 0, as = "div" }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0, rootMargin: "0px 0px -20% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Tag = as as "div";

  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
