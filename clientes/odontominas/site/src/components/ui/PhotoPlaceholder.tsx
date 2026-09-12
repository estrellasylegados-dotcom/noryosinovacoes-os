import { ReactNode } from "react";

/**
 * Painel editorial pra um espaço de fotografia real que ainda não existe
 * (Dra. Ariadna, clínica, equipe). Nunca usar foto de banco fingindo ser da
 * OdontoMinas — se não há fotografia, o layout precisa ficar bonito sem
 * fingir que existe uma (ver clientes/odontominas/andamento.md). O aviso de
 * substituição fica só em comentário, nunca como texto visível.
 */
export function PhotoPlaceholder({
  aspect = "aspect-[4/5]",
  label,
  icon,
  className = "",
}: {
  aspect?: string;
  label?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    // TODO_CLIENTE: substituir por fotografia real (Dra. Ariadna / clínica / equipe).
    <div
      className={`relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline)] ${aspect} ${className}`}
      style={{
        background:
          "radial-gradient(120% 100% at 15% 0%, color-mix(in oklab, var(--color-cyan) 14%, transparent), transparent 55%), var(--color-surface-3)",
      }}
      aria-hidden
    >
      <div className="absolute inset-0 flex items-center justify-center text-[var(--color-cyan)]/50">
        {icon}
      </div>
      {label && (
        <span className="absolute bottom-4 left-4 t-label rounded-full border border-[var(--hairline-strong)] bg-[var(--color-surface-1)]/85 px-3 py-1.5 text-[var(--color-text-dim)] backdrop-blur-sm">
          {label}
        </span>
      )}
    </div>
  );
}
