"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StatusDisparo } from "@/lib/disparos";

type Acao = "iniciar" | "pausar" | "retomar" | "cancelar";

const ROTULO: Record<Acao, string> = {
  iniciar: "Iniciar disparo",
  pausar: "Pausar",
  retomar: "Retomar",
  cancelar: "Cancelar disparo",
};

/** Ações disponíveis variam por status — mesmo espírito de ControleOdontoAcoes.tsx (fetch cru + useState). */
function acoesDisponiveis(status: StatusDisparo): Acao[] {
  if (status === "rascunho") return ["iniciar", "cancelar"];
  if (status === "enviando") return ["pausar", "cancelar"];
  if (status === "pausada") return ["retomar", "cancelar"];
  return [];
}

export function DisparosLoteAcoes({ disparoId, status }: { disparoId: string; status: StatusDisparo }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState<Acao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const acoes = acoesDisponiveis(status);
  if (acoes.length === 0) return null;

  async function executar(acao: Acao) {
    if (acao === "cancelar" && !window.confirm("Cancelar este disparo? Destinatários ainda pendentes não recebem mensagem.")) {
      return;
    }

    setCarregando(acao);
    setErro(null);
    try {
      const res = await fetch(`/api/disparos/lotes/${disparoId}/${acao}`, { method: "POST" });
      const corpo = await res.json();
      if (!corpo.ok) {
        setErro(corpo.error === "transicao_invalida" ? "O status mudou — atualize a página." : "Não consegui completar a ação agora.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Não consegui completar a ação agora.");
    } finally {
      setCarregando(null);
    }
  }

  return (
    <div className="mt-4 border-t border-neutral-100 pt-4">
      <div className="flex flex-wrap gap-2">
        {acoes.map((acao) => (
          <button
            key={acao}
            type="button"
            onClick={() => executar(acao)}
            disabled={carregando !== null}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
              acao === "cancelar"
                ? "border border-red-200 text-red-600 hover:bg-red-50"
                : "bg-teal-700 text-white"
            }`}
          >
            {carregando === acao ? "Aplicando…" : ROTULO[acao]}
          </button>
        ))}
      </div>
      {erro && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
