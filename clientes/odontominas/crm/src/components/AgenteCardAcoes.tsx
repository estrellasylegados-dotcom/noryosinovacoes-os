"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AgenteCardAcoes({ id, ativo }: { id: string; ativo: boolean }) {
  const router = useRouter();
  const [alterando, setAlterando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

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

  async function duplicar() {
    await fetch(`/api/agentes/${id}/duplicar`, { method: "POST" });
    router.refresh();
  }

  async function excluir() {
    setExcluindo(true);
    try {
      await fetch(`/api/agentes/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setExcluindo(false);
      setConfirmandoExclusao(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
      <button
        type="button"
        onClick={alternarAtivo}
        disabled={alterando}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
          ativo ? "border border-neutral-200 text-neutral-600 hover:bg-neutral-100" : "bg-teal-700 text-white"
        }`}
      >
        {ativo ? "Pausar" : "Ativar"}
      </button>
      <Link
        href={`/agentes/${id}`}
        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
      >
        Editar
      </Link>
      <button
        type="button"
        onClick={duplicar}
        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
      >
        Duplicar
      </button>
      <button
        type="button"
        onClick={() => setConfirmandoExclusao(true)}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        Excluir
      </button>

      {confirmandoExclusao && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h2 className="mb-1 text-base font-semibold text-neutral-900">Excluir este agente?</h2>
            <p className="mb-3 text-sm text-neutral-600">
              As conversas que ele estava respondendo deixam de ser respondidas automaticamente. As
              mensagens que ele já enviou continuam no histórico.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(false)}
                className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={excluindo}
                onClick={excluir}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {excluindo ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
