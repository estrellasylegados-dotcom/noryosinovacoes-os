"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PacienteResumo } from "@/lib/pacientes";

/**
 * Registro manual de comparecimento/fechamento (item 18 do briefing) —
 * único jeito de preencher esses 2 marcos hoje: sem ControleODONTO real
 * ainda, "não inventar receita" significa que `valor` só existe quando
 * alguém digita de verdade aqui.
 */
export function CampanhaEventoManual({ campanhaId, pacientes }: { campanhaId: string; pacientes: PacienteResumo[] }) {
  const router = useRouter();
  const [pacienteId, setPacienteId] = useState(pacientes[0]?.id ?? "");
  const [tipo, setTipo] = useState<"appointment_attended" | "treatment_closed">("appointment_attended");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  if (pacientes.length === 0) {
    return <p className="text-sm text-neutral-400">Nenhum lead vinculado a esta campanha ainda.</p>;
  }

  async function registrar() {
    if (tipo === "treatment_closed" && (!valor.trim() || Number(valor) <= 0)) {
      setMensagem("Informe o valor do fechamento.");
      return;
    }

    setSalvando(true);
    setMensagem(null);
    try {
      const res = await fetch(`/api/campanhas/${campanhaId}/eventos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, pacienteId, valor: tipo === "treatment_closed" ? Number(valor) : undefined }),
      });
      const corpo = await res.json();
      if (!corpo.ok) {
        setMensagem(corpo.error === "valor_obrigatorio" ? "Informe o valor do fechamento." : "Não consegui registrar agora.");
        return;
      }
      setMensagem(corpo.novo ? "Registrado." : "Esse marco já estava registrado pra este paciente.");
      setValor("");
      router.refresh();
    } catch {
      setMensagem("Não consegui registrar agora.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select value={pacienteId} onChange={(e) => setPacienteId(e.target.value)} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm">
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>{p.nome ?? p.telefone}</option>
          ))}
        </select>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as "appointment_attended" | "treatment_closed")}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        >
          <option value="appointment_attended">Compareceu</option>
          <option value="treatment_closed">Fechou tratamento</option>
        </select>
        {tipo === "treatment_closed" && (
          <input
            type="number"
            min={0}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Valor (R$)"
            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        )}
      </div>
      <button
        type="button"
        onClick={registrar}
        disabled={salvando}
        className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
      >
        {salvando ? "Registrando…" : "Registrar"}
      </button>
      {mensagem && <p className="text-xs text-neutral-500">{mensagem}</p>}
    </div>
  );
}
