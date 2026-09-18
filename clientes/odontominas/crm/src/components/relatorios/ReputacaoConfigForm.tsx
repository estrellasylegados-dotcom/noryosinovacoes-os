"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReputacaoConfig } from "@/lib/reputacao-config";

const MENSAGEM_ERRO: Record<string, string> = {
  url_ausente: "Pra ativar o módulo, cadastre o link de avaliação do Google.",
  url_invalida: "Esse link não parece uma URL válida (precisa começar com https://).",
  delay_invalido: "O atraso precisa ser um número de horas inteiro, 0 ou maior.",
};

const CLASSE_INPUT = "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm";

/** Fase 5 — Configurações → Reputação. Só a config nível-clínica mora aqui; a mensagem enviada é o nó "mensagem" do Fluxo de Reputação. */
export function ReputacaoConfigForm({ configInicial }: { configInicial: ReputacaoConfig }) {
  const router = useRouter();
  const [ativo, setAtivo] = useState(configInicial.ativo);
  const [url, setUrl] = useState(configInicial.googleReviewUrl ?? "");
  const [rastrearCliques, setRastrearCliques] = useState(configInicial.rastrearCliques);
  const [delay, setDelay] = useState(configInicial.delayHorasPadrao?.toString() ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setSucesso(false);
    try {
      const resposta = await fetch("/api/reputacao/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ativo,
          googleReviewUrl: url.trim() || null,
          rastrearCliques,
          delayHorasPadrao: delay.trim() === "" ? null : Number(delay),
          automacaoAtendimentoConcluidoAtiva: false,
        }),
      });
      const resultado = (await resposta.json()) as { ok: boolean; error?: string };
      if (!resultado.ok) {
        setErro((resultado.error && MENSAGEM_ERRO[resultado.error]) || "Não deu pra salvar.");
        return;
      }
      setSucesso(true);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
      <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
        Módulo ativo
      </label>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Link de avaliação (Google)</label>
        <input
          type="url"
          placeholder="https://g.page/r/…/review"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={CLASSE_INPUT}
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" checked={rastrearCliques} onChange={(e) => setRastrearCliques(e.target.checked)} />
        Rastrear cliques (recomendado — sem isso, o link vai direto pro Google e o dashboard não mostra clique)
      </label>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">
          Atraso padrão pra automação futura (horas) — opcional, sem efeito ainda
        </label>
        <input
          type="number"
          min={0}
          step={1}
          value={delay}
          onChange={(e) => setDelay(e.target.value)}
          className={`${CLASSE_INPUT} max-w-[160px]`}
        />
      </div>

      <div>
        <p className="text-xs font-medium text-neutral-600">Automação a partir de atendimento concluído</p>
        <p className="mt-1 text-sm text-neutral-400">Desativada — aguardando origem confiável de atendimento concluído.</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        {sucesso && <span className="text-xs font-medium text-teal-700">Salvo.</span>}
        {erro && <span className="text-xs text-red-600">{erro}</span>}
      </div>
    </div>
  );
}
