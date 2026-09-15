"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Recarrega os dados do servidor periodicamente — sem isso, uma mensagem
 * nova só apareceria se alguém desse F5 no meio da demonstração ao vivo.
 */
export function AutoRefresh({ intervaloMs = 20000 }: { intervaloMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervaloMs);
    return () => clearInterval(id);
  }, [router, intervaloMs]);

  return null;
}
