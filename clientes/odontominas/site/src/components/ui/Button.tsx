import Link from "next/link";
import { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "group/btn inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] px-6 py-3.5 text-sm font-semibold tracking-tight transition-[transform,background-color,border-color,color,filter] duration-200 ease-[var(--ease-premium)] focus-visible:outline-2 disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  // Hover mais escuro (nunca "brightness" — clareava a cor da marca em vez de aprofundar). Deslocamento de 1px só, nada além disso.
  primary:
    "bg-[var(--color-cyan)] text-[var(--color-ink)] shadow-[0_10px_30px_-12px_rgba(23,138,138,0.5)] hover:bg-[var(--color-cyan-hover)] hover:-translate-y-px active:translate-y-0",
  secondary:
    "border border-[var(--hairline-strong)] text-[var(--color-text)] hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)] hover:-translate-y-px active:translate-y-0",
  ghost:
    "text-[var(--color-text)] underline decoration-[var(--hairline-strong)] underline-offset-4 hover:decoration-[var(--color-cyan)] hover:text-[var(--color-cyan)]",
};

function Inner({ children, withArrow }: { children: ReactNode; withArrow?: boolean }) {
  return (
    <>
      {children}
      {withArrow && <Icon name="arrow" size={16} className="btn-arrow" />}
    </>
  );
}

type LinkButtonProps = {
  href: string;
  variant?: Variant;
  children: ReactNode;
  withArrow?: boolean;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

export function ButtonLink({
  href,
  variant = "primary",
  children,
  className = "",
  withArrow = false,
  ...rest
}: LinkButtonProps) {
  const isExternal = href.startsWith("http") || href.startsWith("mailto:");
  const cls = `${base} ${variants[variant]} ${className}`;
  const content = <Inner withArrow={withArrow}>{children}</Inner>;

  if (isExternal) {
    return (
      <a
        href={href}
        className={cls}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel="noopener noreferrer"
        {...rest}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={cls} {...rest}>
      {content}
    </Link>
  );
}

type ButtonProps = { variant?: Variant; withArrow?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = "primary", className = "", children, withArrow = false, ...rest }: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      <Inner withArrow={withArrow}>{children}</Inner>
    </button>
  );
}
