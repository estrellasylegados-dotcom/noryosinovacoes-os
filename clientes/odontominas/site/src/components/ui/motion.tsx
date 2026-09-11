"use client";

import { ElementType, ReactNode } from "react";
import { useInView, useParallax } from "@/lib/hooks";
import { staggerIndex, animDelay, type AnimName } from "@/lib/motion";

/**
 * Camada de entrada — envolve conteúdo e adiciona `.is-in` quando entra na
 * viewport. O estado inicial/transição vive em globals.css ([data-anim]).
 * prefers-reduced-motion é neutralizado lá.
 */
type SectionRevealProps = {
  children: ReactNode;
  as?: ElementType;
  anim?: AnimName;
  /** atraso pontual em ms (entrada isolada) */
  delay?: number;
  className?: string;
  id?: string;
};

export function SectionReveal({
  children,
  as: Tag = "div",
  anim = "fade-up",
  delay = 0,
  className = "",
  id,
}: SectionRevealProps) {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      id={id}
      data-anim={anim}
      className={`${inView ? "is-in" : ""} ${className}`}
      style={delay ? animDelay(delay) : undefined}
    >
      {children}
    </Tag>
  );
}

/**
 * Container de stagger — os filhos diretos entram em sequência. Cada filho
 * precisa ter `data-anim` (use <StaggerItem> ou passe manualmente).
 */
export function Stagger({
  children,
  as: Tag = "div",
  className = "",
  id,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  id?: string;
}) {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <Tag ref={ref} id={id} data-stagger className={`${inView ? "is-in" : ""} ${className}`}>
      {children}
    </Tag>
  );
}

/**
 * Drift de parallax no scroll — o filho desliza no eixo Y conforme cruza a
 * viewport. Uso pontual: hero, blocos de destaque. Desligado em
 * reduced-motion pelo hook.
 */
export function Parallax({
  children,
  strength = 36,
  className = "",
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const [ref, offset] = useParallax<HTMLDivElement>(strength);
  return (
    <div
      ref={ref}
      className={className}
      style={{ transform: `translate3d(0, ${offset}px, 0)`, willChange: "transform" }}
    >
      {children}
    </div>
  );
}

export function StaggerItem({
  children,
  index,
  as: Tag = "div",
  anim = "fade-up",
  className = "",
}: {
  children: ReactNode;
  index: number;
  as?: ElementType;
  anim?: AnimName;
  className?: string;
}) {
  return (
    <Tag data-anim={anim} style={staggerIndex(index)} className={className}>
      {children}
    </Tag>
  );
}
