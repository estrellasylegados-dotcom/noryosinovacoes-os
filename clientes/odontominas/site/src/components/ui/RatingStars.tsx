import { Icon } from "./Icon";

/** ★★★★★ real (não emoji) — decorativo; o texto ao lado carrega o dado pro leitor de tela. */
export function RatingStars({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 text-[var(--color-cyan)] ${className}`} aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon key={i} name="star" size={size} fill="currentColor" stroke="none" />
      ))}
    </span>
  );
}
