import { getWhatsappLink } from "@/lib/config";
import { analyticsEvents } from "@/lib/config";
import { ButtonLink } from "./ui/Button";

type Props = {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  message?: string;
  className?: string;
};

/**
 * Único ponto de saída pro WhatsApp em todo o site. Nenhum outro componente
 * deve montar o link `wa.me/...` na mão — sempre importar isto.
 */
export function WhatsappCTA({ children, variant = "primary", message, className }: Props) {
  return (
    <ButtonLink
      href={getWhatsappLink(message)}
      variant={variant}
      className={className}
      data-analytics-event={analyticsEvents.clickWhatsapp}
    >
      {children}
    </ButtonLink>
  );
}
