"use client";

import { useEffect, useState } from "react";

type NotaInterna = {
  id: string;
  atendenteNome: string | null;
  texto: string;
  criadaEm: string;
};

function formatQuando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Nunca visível pro paciente — anotação interna da equipe presa à conversa
 * (tabela `notas_internas`, fora do alcance do webhook/motor do Fluxo de
 * Conversa). Self-contained: busca as notas sozinho quando `conversaId` muda.
 */
export function NotasInternas({ conversaId }: { conversaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [notas, setNotas] = useState<NotaInterna[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    setTexto("");
    fetch(`/api/chat/conversas/${conversaId}/notas`)
      .then((r) => r.json())
      .then((resultado: { ok: boolean; notas?: NotaInterna[] }) => {
        if (cancelado) return;
        setNotas(resultado.ok && resultado.notas ? resultado.notas : []);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [conversaId]);

  async function adicionar() {
    if (!texto.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/chat/conversas/${conversaId}/notas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const resultado = (await resposta.json()) as { ok: boolean; nota?: NotaInterna; error?: string };
      if (!resultado.ok || !resultado.nota) {
        setErro(resultado.error === "texto_muito_longo" ? "Nota muito longa (máx. 2000 caracteres)." : "Não deu pra salvar a nota.");
        return;
      }
      setNotas((prev) => [resultado.nota!, ...prev]);
      setTexto("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="border-t border-neutral-200 bg-neutral-50/60 px-4 py-2">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-neutral-400 hover:text-neutral-600"
      >
        <span>
          Notas internas{notas.length > 0 ? ` (${notas.length})` : ""} · nunca visível pro paciente
        </span>
        <span aria-hidden>{aberto ? "▾" : "▸"}</span>
      </button>
      {aberto && <div className="mt-2 space-y-3">
      <div className="flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              adicionar();
            }
          }}
          placeholder="Anotar algo sobre esta conversa…"
          rows={2}
          className="max-h-24 min-h-[42px] flex-1 resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
        <button
          type="button"
          disabled={enviando || !texto.trim()}
          onClick={adicionar}
          className="shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? "Salvando…" : "Anotar"}
        </button>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {carregando ? (
        <p className="text-xs text-neutral-400">Carregando…</p>
      ) : notas.length === 0 ? (
        <p className="text-xs text-neutral-400">Nenhuma nota ainda.</p>
      ) : (
        <ul className="max-h-40 space-y-2 overflow-y-auto">
          {notas.map((n) => (
            <li key={n.id} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-neutral-700">
              <p className="whitespace-pre-wrap">{n.texto}</p>
              <p className="mt-1 text-[10px] text-neutral-400">
                {n.atendenteNome ?? "—"} · {formatQuando(n.criadaEm)}
              </p>
            </li>
          ))}
        </ul>
      )}
      </div>}
    </div>
  );
}
