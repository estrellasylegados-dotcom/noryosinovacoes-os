import { getWhatsappLink, analyticsEvents, type WhatsappOrigem } from "@/lib/config";
import { ButtonLink } from "./ui/Button";

type Props = {
  children: React.ReactNode;
  origem: WhatsappOrigem;
  variant?: "primary" | "secondary" | "ghost";
  message?: string;
  withArrow?: boolean;
  className?: string;
};

/**
 * Único ponto de saída pro WhatsApp em todo o site. Nenhum outro componente
 * deve montar o link `wa.me/...` na mão — sempre importar isto, sempre
 * informando `origem` (identifica o CTA no funil: header, hero, implantes...).
 */
export function WhatsappCTA({ children, origem, variant = "primary", message, withArrow, className }: Props) {
  return (
    <ButtonLink
      href={getWhatsappLink(origem, message)}
      variant={variant}
      withArrow={withArrow}
      className={className}
      data-analytics-event={analyticsEvents.whatsapp(origem)}
    >
      {children}
    </ButtonLink>
  );
}
