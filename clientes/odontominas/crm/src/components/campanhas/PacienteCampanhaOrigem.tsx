"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

type CampanhaOpcao = { id: string; nome: string };

/** Vínculo manual paciente↔campanha (item 14 do briefing) — só admin, direto da ficha do paciente. */
export function PacienteCampanhaOrigem({
  pacienteId,
  campanhaAtualId,
  campanhas,
}: {
  pacienteId: string;
  campanhaAtualId: string | null;
  campanhas: CampanhaOpcao[];
}) {
  const router = useRouter();
  const [campanhaId, setCampanhaId] = useState(campanhaAtualId ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await fetch(`/api/pacientes/${pacienteId}/campanha`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campanhaId: campanhaId || null }),
      });
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  const campanhaAtual = campanhas.find((c) => c.id === campanhaAtualId);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
      <span className="font-medium text-neutral-600">Campanha de origem:</span>
      {campanhaAtual && (
        <Link href={`/campanhas/${campanhaAtual.id}`} className="text-teal-700 hover:underline">
          {campanhaAtual.nome}
        </Link>
      )}
      <select value={campanhaId} onChange={(e) => setCampanhaId(e.target.value)} className="rounded-lg border border-neutral-200 px-2 py-1 text-xs">
        <option value="">Nenhuma</option>
        {campanhas.map((c) => (
          <option key={c.id} value={c.id}>{c.nome}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={salvar}
        disabled={salvando || campanhaId === (campanhaAtualId ?? "")}
        className="rounded-lg bg-teal-700 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
