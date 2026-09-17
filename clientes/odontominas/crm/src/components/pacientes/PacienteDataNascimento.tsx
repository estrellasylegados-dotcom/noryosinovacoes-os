"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Fase 3 — edição da data de nascimento direto da ficha do paciente (mesmo padrão de PacienteCampanhaOrigem.tsx). */
export function PacienteDataNascimento({ pacienteId, dataNascimentoAtual }: { pacienteId: string; dataNascimentoAtual: string | null }) {
  const router = useRouter();
  const [valor, setValor] = useState(dataNascimentoAtual ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/pacientes/${pacienteId}/data-nascimento`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataNascimento: valor || null }),
      });
      const resultado = (await resposta.json()) as { ok: boolean; error?: string };
      if (!resultado.ok) {
        setErro(resultado.error === "data_futura" ? "Data não pode ser no futuro." : "Não deu pra salvar.");
        return;
      }
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
      <span className="font-medium text-neutral-600">Data de nascimento:</span>
      <input
        type="date"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        max={new Date().toISOString().slice(0, 10)}
        className="rounded-lg border border-neutral-200 px-2 py-1 text-xs"
      />
      <button
        type="button"
        onClick={salvar}
        disabled={salvando || valor === (dataNascimentoAtual ?? "")}
        className="rounded-lg bg-teal-700 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        {salvando ? "Salvando…" : "Salvar"}
      </button>
      {erro && <span className="text-red-600">{erro}</span>}
    </div>
  );
}
