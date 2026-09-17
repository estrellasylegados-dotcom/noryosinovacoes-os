"use client";

import type { ReactNode } from "react";

const ANEL_PROBLEMA: Record<"erro" | "aviso", string> = {
  erro: "ring-2 ring-red-400",
  aviso: "ring-2 ring-amber-400",
};

/** Casca visual compartilhada pelos 6 cartões de nó — cada um só define ícone/título/conteúdo/handles próprios. */
export function NoCardBase({
  titulo,
  icone,
  problema,
  emExecucao,
  children,
}: {
  titulo: string;
  icone: ReactNode;
  problema?: "erro" | "aviso";
  emExecucao?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`w-56 rounded-xl border bg-white p-3 text-left shadow-sm ${
        problema ? ANEL_PROBLEMA[problema] : "border-neutral-200"
      } ${emExecucao ? "ring-2 ring-blue-400 animate-pulse" : ""}`}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
        {icone}
        {titulo}
      </div>
      {children}
    </div>
  );
}
