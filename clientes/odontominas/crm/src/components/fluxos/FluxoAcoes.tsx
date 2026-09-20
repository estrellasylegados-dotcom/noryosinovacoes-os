"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { StatusFluxo } from "@/lib/fluxo-versoes";

export function FluxoAcoes({ id, status, permissoes }: { id: string; status: StatusFluxo; permissoes: string[] }) {
  const router = useRouter();
  const [alterando, setAlterando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const podeEditar = permissoes.includes("automacoes.editar");
  const podeAtivar = permissoes.includes("automacoes.ativar");
  const podePausar = permissoes.includes("automacoes.pausar");
  const podeExcluir = permissoes.includes("automacoes.excluir");

  async function mudarStatus(novo: StatusFluxo, interromperExecucoes = false) {
    setAlterando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/fluxos/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novo, interromperExecucoes }),
      });
      const resultado = await resposta.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!resposta.ok || !resultado?.ok) {
        setErro(resultado?.error === "comercial_nao_habilitado"
          ? "As automações comerciais ainda não estão habilitadas neste ambiente."
          : "Não foi possível alterar o status da automação. Tente novamente.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Não foi possível alterar o status da automação. Tente novamente.");
    } finally {
      setAlterando(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {podeEditar && <Link
        href={`/fluxos/${id}/editar`}
        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
      >
        Editar
      </Link>}
      {status === "ativo" && podePausar && (
        <button
          type="button"
          disabled={alterando}
          onClick={() => {
            const interromper = window.confirm(
              "Também interromper as execuções que já estão em andamento?\n\nOK: interromper agora.\nCancelar: manter as execuções atuais e pausar somente novas entradas."
            );
            void mudarStatus("pausado", interromper);
          }}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
        >
          Pausar
        </button>
      )}
      {status === "pausado" && podeAtivar && (
        <button
          type="button"
          disabled={alterando}
          onClick={() => mudarStatus("ativo")}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          Ativar
        </button>
      )}
      {status !== "arquivado" && podeExcluir ? (
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
      ) : status === "arquivado" && podeAtivar ? (
        <button
          type="button"
          disabled={alterando}
          onClick={() => mudarStatus("ativo")}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
        >
          Reativar
        </button>
      ) : null}
      {erro && <p role="alert" className="basis-full text-xs text-red-600">{erro}</p>}
    </div>
  );
}
