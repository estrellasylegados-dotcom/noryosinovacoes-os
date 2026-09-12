"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * Único listener de clique da aplicação. Qualquer elemento com
 * `data-analytics-event="nome_do_evento"` é rastreado automaticamente — os
 * CTAs (WhatsApp, telefone, mapa) continuam Server Component, só marcam o
 * atributo; nenhum precisa virar "use client" só pra registrar um clique.
 */
export function AnalyticsBinder() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!(e.target instanceof Element)) return;
      const el = e.target.closest<HTMLElement>("[data-analytics-event]");
      const event = el?.dataset.analyticsEvent;
      if (event) track(event);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
