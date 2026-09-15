"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Notificacao } from "@/lib/notificacoes";

const INTERVALO_MS = 20000;

export function Notificacoes({ inicial }: { inicial: Notificacao[] }) {
  const [notificacoes, setNotificacoes] = useState(inicial);
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/notificacoes");
        const dados = (await res.json()) as { ok: boolean; notificacoes?: Notificacao[] };
        if (dados.ok && dados.notificacoes) setNotificacoes(dados.notificacoes);
      } catch {
        // silencioso — próximo ciclo tenta de novo, não vale travar a UI por isso.
      }
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function fecharSeFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fecharSeFora);
    return () => document.removeEventListener("mousedown", fecharSeFora);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        title="Notificações"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
      >
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {notificacoes.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {notificacoes.length > 99 ? "99+" : notificacoes.length}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-11 z-20 w-80 rounded-xl border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">Notificações</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notificacoes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-400">Nada pendente agora.</p>
            ) : (
              notificacoes.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => setAberto(false)}
                  className="flex items-start gap-2.5 border-b border-neutral-50 px-4 py-3 last:border-0 hover:bg-neutral-50"
                >
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      n.tipo === "nao_lida" ? "bg-teal-600" : "bg-red-500"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">{n.titulo}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {n.tipo === "nao_lida" ? "Mensagem não lida — " : "Esfriando — "}
                      {n.subtitulo}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
