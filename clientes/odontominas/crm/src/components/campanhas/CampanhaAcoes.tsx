"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StatusCampanha } from "@/lib/campanhas";

type Acao = "agendar" | "iniciar" | "pausar" | "retomar" | "encerrar" | "cancelar";

const ROTULO: Record<Acao, string> = {
  agendar: "Agendar",
  iniciar: "Iniciar campanha",
  pausar: "Pausar",
  retomar: "Retomar",
  encerrar: "Encerrar campanha",
  cancelar: "Cancelar campanha",
};

function acoesDisponiveis(status: StatusCampanha): Acao[] {
  if (status === "rascunho") return ["agendar", "iniciar", "cancelar"];
  if (status === "agendada") return ["iniciar", "cancelar"];
  if (status === "ativa") return ["pausar", "encerrar", "cancelar"];
  if (status === "pausada") return ["retomar", "encerrar", "cancelar"];
  return [];
}

const CONFIRMACAO: Partial<Record<Acao, string>> = {
  cancelar: "Cancelar esta campanha? Isso não afeta disparos já enviados, mas encerra o acompanhamento dela.",
  encerrar: "Encerrar esta campanha? Você ainda pode registrar comparecimento/fechamento depois.",
};

export function CampanhaAcoes({ campanhaId, status }: { campanhaId: string; status: StatusCampanha }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState<Acao | "duplicar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const acoes = acoesDisponiveis(status);

  async function executar(acao: Acao) {
    const confirmacao = CONFIRMACAO[acao];
    if (confirmacao && !window.confirm(confirmacao)) return;

    setCarregando(acao);
    setErro(null);
    try {
      const res = await fetch(`/api/campanhas/${campanhaId}/${acao}`, { method: "POST" });
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

  async function duplicar() {
    setCarregando("duplicar");
    setErro(null);
    try {
      const res = await fetch(`/api/campanhas/${campanhaId}/duplicar`, { method: "POST" });
      const corpo = await res.json();
      if (!corpo.ok || !corpo.id) {
        setErro("Não consegui duplicar a campanha agora.");
        return;
      }
      router.push(`/campanhas/${corpo.id}/editar`);
    } catch {
      setErro("Não consegui duplicar a campanha agora.");
    } finally {
      setCarregando(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {acoes.map((acao) => (
          <button
            key={acao}
            type="button"
            onClick={() => executar(acao)}
            disabled={carregando !== null}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
              acao === "cancelar" ? "border border-red-200 text-red-600 hover:bg-red-50" : "bg-teal-700 text-white"
            }`}
          >
            {carregando === acao ? "Aplicando…" : ROTULO[acao]}
          </button>
        ))}
        <button
          type="button"
          onClick={duplicar}
          disabled={carregando !== null}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
        >
          {carregando === "duplicar" ? "Duplicando…" : "Duplicar"}
        </button>
      </div>
      {erro && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
