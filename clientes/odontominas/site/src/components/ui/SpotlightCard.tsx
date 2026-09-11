"use client";

import { ElementType, ReactNode } from "react";
import { useSpotlight } from "@/lib/hooks";

/**
 * Superfície de card padrão do redesign — profundidade por gradiente sutil
 * + hairline dupla + sombra discreta, e um spotlight de baixa intensidade
 * que acompanha o cursor no desktop (§15). Sem efeito "gaming".
 */
export function SpotlightCard({
  children,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
}) {
  const ref = useSpotlight<HTMLDivElement>();
  return (
    <Tag ref={ref} className={`spotlight-card ${className}`}>
      {children}
    </Tag>
  );
}
