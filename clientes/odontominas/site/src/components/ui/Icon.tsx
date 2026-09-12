import type { SVGProps } from "react";

/**
 * Set de ícones lineares — stroke 1.5, grid 24, cantos levemente
 * arredondados. Um estilo só. Sempre decorativo: `aria-hidden` por padrão;
 * o rótulo vem do texto ao lado.
 */
export type IconName =
  | "arrow"
  | "check"
  | "chevron"
  | "pin"
  | "clock"
  | "phone"
  | "tooth"
  | "shield"
  | "calendar"
  | "crown"
  | "sparkle"
  | "star";

const paths: Record<IconName, React.ReactNode> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="M4 12.5 9 17.5 20 6.5" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  phone: (
    <path d="M6 3h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2L20 14v3a2 2 0 0 1-2 2C10.3 19 5 13.7 5 6a2 2 0 0 1 1-3Z" />
  ),
  tooth: (
    <path d="M12 3c2.5 0 4.5 1.6 4.5 4.2 0 1.6-.5 2.3-.5 4.3 0 2.3 1 4 1 6a2.5 2.5 0 0 1-5 0c0-1.5-.5-2.2-1-2.2s-1 .7-1 2.2a2.5 2.5 0 0 1-5 0c0-2 1-3.7 1-6 0-2-.5-2.7-.5-4.3C5.5 4.6 7.5 3 10 3c.7 0 1.4.2 2 .5.6-.3 1.3-.5 0-.5Z" />
  ),
  shield: (
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  crown: (
    <path d="M4 18h16M4 18l-1.5-9L8 12l4-7 4 7 5.5-3L20 18" />
  ),
  sparkle: (
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
  ),
  star: (
    <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7L12 3Z" />
  ),
};

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

export function Icon({ name, size = 20, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
