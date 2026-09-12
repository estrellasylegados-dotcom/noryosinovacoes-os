import { getWhatsappLink, analyticsEvents } from "@/lib/config";
import { siteConfig } from "@/lib/config";

/**
 * Ponto fixo de conversão. Discreto no desktop (pílula com rótulo),
 * acessível no mobile (ícone). Usa o verde oficial do WhatsApp só aqui —
 * exceção registrada no design system (não é cor da marca OdontoMinas).
 */
export function FloatingWhatsapp() {
  return (
    <a
      href={getWhatsappLink("float")}
      target="_blank"
      rel="noopener noreferrer"
      data-analytics-event={analyticsEvents.whatsapp("float")}
      aria-label={`Conversar com a ${siteConfig.shortName} no WhatsApp`}
      className="group fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full border border-[var(--hairline-strong)] bg-[var(--color-surface-raised)]/90 py-2.5 pl-2.5 pr-3 text-sm font-medium text-[var(--color-text)] shadow-[var(--elev-2)] backdrop-blur-md transition-transform duration-200 hover:-translate-y-0.5 sm:bottom-6 sm:right-6"
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-whatsapp)] text-white">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.1h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.14.82.84-3.06-.2-.31a8.2 8.2 0 0 1-1.26-4.4c0-4.54 3.7-8.24 8.26-8.24a8.2 8.2 0 0 1 8.24 8.25c0 4.55-3.7 8.27-8.24 8.27Zm4.52-6.19c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.16.24-.64.81-.78.98-.14.16-.29.18-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.24-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.16 0-.42.06-.64.31-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28Z" />
        </svg>
      </span>
      <span className="hidden sm:inline">Conversar</span>
    </a>
  );
}
