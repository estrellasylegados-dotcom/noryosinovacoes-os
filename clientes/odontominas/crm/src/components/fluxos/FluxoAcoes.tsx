"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StatusFluxo } from "@/lib/fluxo-versoes";

export function FluxoAcoes({ id, status }: { id: string; status: StatusFluxo }) {
  const router = useRouter();
  const [alterando, setAlterando] = useState(false);

  async function mudarStatus(novo: StatusFluxo) {
    setAlterando(true);
    try {
      await fetch(`/api/fluxos/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novo }),
      });
      router.refresh();
    } finally {
      setAlterando(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/fluxos/${id}/editar`}
        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
      >
        Editar
      </Link>
      {status === "ativo" && (
        <button
          type="button"
          disabled={alterando}
          onClick={() => mudarStatus("pausado")}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
        >
          Pausar
        </button>
      )}
      {status === "pausado" && (
        <button
          type="button"
          disabled={alterando}
          onClick={() => mudarStatus("ativo")}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          Ativar
        </button>
      )}
      {status !== "arquivado" ? (
        <button
          type="button"
          disabled={alterando}
          onClick={() => {
            if (window.confirm("Arquivar este fluxo? Ele para de disparar por gatilho automático.")) mudarStatus("arquivado");
          }}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          Arquivar
        </button>
      ) : (
        <button
          type="button"
          disabled={alterando}
          onClick={() => mudarStatus("ativo")}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
        >
          Reativar
        </button>
      )}
    </div>
  );
}
