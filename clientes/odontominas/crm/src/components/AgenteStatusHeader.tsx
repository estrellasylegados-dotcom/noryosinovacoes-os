"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Cabeçalho de `/agentes/[id]` (print de referência): voltar, nome, status e o Ativar/Pausar — mesmo endpoint que `AgenteCardAcoes` usa na lista. */
export function AgenteStatusHeader({ id, nome, ativo }: { id: string; nome: string; ativo: boolean }) {
  const router = useRouter();
  const [alterando, setAlterando] = useState(false);

  async function alternarAtivo() {
    setAlterando(true);
    try {
      await fetch(`/api/agentes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !ativo }),
      });
      router.refresh();
    } finally {
      setAlterando(false);
    }
  }

  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link href="/agentes" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600" aria-label="Voltar">
          ←
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-neutral-900">{nome}</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                ativo ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-neutral-100 text-neutral-500 ring-neutral-500/20"
              }`}
            >
              {ativo ? "Ativo" : "Pausado"}
            </span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={alternarAtivo}
        disabled={alterando}
        className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${
          ativo ? "border border-neutral-200 text-neutral-600 hover:bg-neutral-100" : "bg-teal-700 text-white"
        }`}
      >
        {alterando ? "…" : ativo ? "Pausar" : "Ativar"}
      </button>
    </header>
  );
}
