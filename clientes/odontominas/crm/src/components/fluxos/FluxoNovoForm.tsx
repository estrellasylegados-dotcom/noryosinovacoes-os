"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TemplateResumo = { id: string; nome: string; descricao: string };

export function FluxoNovoForm({ templates }: { templates: TemplateResumo[] }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    if (!nome.trim()) {
      setErro("Dá um nome pro fluxo antes de continuar.");
      return;
    }
    setCriando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/fluxos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, descricao: descricao || null, templateId }),
      });
      const resultado = (await resposta.json()) as { ok: boolean; id?: string; error?: string };
      if (!resultado.ok || !resultado.id) {
        setErro("Não consegui criar o fluxo agora. Tenta de novo em instantes.");
        return;
      }
      router.push(`/fluxos/${resultado.id}/editar`);
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="mt-6 space-y-5">
      <div>
        <label className="block text-sm font-medium text-neutral-700">Nome</label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Atendimento inicial"
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700">Descrição (opcional)</label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700">Ponto de partida</label>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setTemplateId(null)}
            className={`rounded-lg border p-3 text-left text-sm ${
              templateId === null ? "border-teal-600 bg-teal-50" : "border-neutral-200 hover:border-neutral-300"
            }`}
          >
            <p className="font-medium text-neutral-900">Em branco</p>
            <p className="mt-0.5 text-xs text-neutral-500">Início → Finalizar, você monta o resto.</p>
          </button>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={`rounded-lg border p-3 text-left text-sm ${
                templateId === t.id ? "border-teal-600 bg-teal-50" : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <p className="font-medium text-neutral-900">{t.nome}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{t.descricao}</p>
            </button>
          ))}
        </div>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        type="button"
        disabled={criando}
        onClick={criar}
        className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {criando ? "Criando…" : "Criar e abrir editor"}
      </button>
    </div>
  );
}
