"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DistribuicaoConfig } from "@/lib/distribuicao-automatica";

const ERROS: Record<string, string> = {
  forbidden: "Voce nao tem permissao para alterar esta configuracao.",
  estrategia_invalida: "Nesta versao, a estrategia disponivel e somente round-robin.",
  invalid_body: "Configuracao invalida.",
};

export function DistribuicaoAutomaticaForm({ configInicial }: { configInicial: DistribuicaoConfig }) {
  const router = useRouter();
  const [ativa, setAtiva] = useState(configInicial.ativa);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setOk(false);
    try {
      const res = await fetch("/api/clinica/distribuicao", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativa, estrategia: "round_robin" }),
      });
      const dados = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!dados.ok) {
        setErro((dados.error && ERROS[dados.error]) || "Nao deu para salvar agora.");
        return;
      }
      setOk(true);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
          <span>
            <span className="text-sm font-medium text-neutral-900">Ativar distribuicao automatica</span>
            <span className="block text-sm text-neutral-500">As novas conversas sem responsavel serao distribuidas entre atendentes elegiveis.</span>
          </span>
        </label>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-900">Estrategia</h2>
        <p className="mt-1 text-sm text-neutral-600">Round-robin</p>
      </section>

      {erro && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      )}
      {ok && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Configuracao salva.
        </p>
      )}
      <button type="button" disabled={salvando} onClick={salvar} className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
