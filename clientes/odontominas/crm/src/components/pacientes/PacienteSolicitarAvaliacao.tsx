"use client";

import { useState } from "react";

const MENSAGEM_ERRO: Record<string, string> = {
  modulo_desativado: "O módulo de Reputação está desligado. Ative em Reputação → Configurações.",
  link_ausente: "Falta cadastrar o link de avaliação do Google em Reputação → Configurações.",
  fluxo_nao_configurado: "Não existe um Fluxo de Reputação ativo. Crie e publique um em Fluxos (template \"Solicitação de Avaliação Google\").",
  ja_em_andamento: "Já existe uma solicitação em andamento para este paciente.",
  paciente_nao_encontrado: "Paciente não encontrado.",
};

/** Fase 5 — ação manual da ficha do paciente. Não manda mensagem direto: só dispara o evento interno (ver /api/reputacao/solicitar). */
export function PacienteSolicitarAvaliacao({ pacienteId }: { pacienteId: string }) {
  const [estado, setEstado] = useState<"idle" | "enviando" | "sucesso">("idle");
  const [erro, setErro] = useState<string | null>(null);

  async function solicitar() {
    setEstado("enviando");
    setErro(null);
    try {
      const resposta = await fetch("/api/reputacao/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pacienteId }),
      });
      const resultado = (await resposta.json()) as { ok: boolean; error?: string };
      if (!resultado.ok) {
        setErro((resultado.error && MENSAGEM_ERRO[resultado.error]) || "Não deu pra solicitar agora.");
        setEstado("idle");
        return;
      }
      setEstado("sucesso");
    } catch {
      setErro("Não deu pra solicitar agora.");
      setEstado("idle");
    }
  }

  if (estado === "sucesso") {
    return <p className="text-xs font-medium text-teal-700">⭐ Solicitação de avaliação enviada.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={solicitar}
        disabled={estado === "enviando"}
        className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        {estado === "enviando" ? "Solicitando…" : "⭐ Solicitar avaliação Google"}
      </button>
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </div>
  );
}
