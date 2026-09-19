"use client";

import { useState } from "react";

/** Motivo estruturado obrigatório (métrica de perdas por motivo depois) + observação opcional. */
export function ModalPerdido({
  motivos,
  onCancelar,
  onConfirmar,
}: {
  motivos: { id: string; nome: string }[];
  onCancelar: () => void;
  onConfirmar: (motivoPerdaId: string, observacao: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [obs, setObs] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Motivo da perda">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-neutral-900">Marcar como perdido</h2>
        <p className="mt-1 text-sm text-neutral-500">Informe o motivo. Ele alimenta os relatórios de perda.</p>
        <label className="mt-4 block text-sm font-medium text-neutral-700">
          Motivo
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm">
            <option value="">Selecione…</option>
            {motivos.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-medium text-neutral-700">
          Observação (opcional)
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-2 text-sm" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">Cancelar</button>
          <button type="button" disabled={!motivo} onClick={() => onConfirmar(motivo, obs)} className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-40">
            Confirmar perda
          </button>
        </div>
      </div>
    </div>
  );
}
