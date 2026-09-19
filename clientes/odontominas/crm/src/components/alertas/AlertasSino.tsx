"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ResumoAlertas } from "@/lib/alertas-consulta";
import { formatDuracao } from "@/lib/tempo";
import { SeveridadeBadge } from "@/components/alertas/SeveridadeBadge";

const INTERVALO_MS = 30000;

/**
 * Indicador de alertas no cabeçalho. Conta só o que está ABERTO e é relevante
 * (crítico + atenção); resolvido nunca conta. Sem toast e sem notificação do
 * navegador: alerta mora na Central, e o número aqui só muda quando a
 * situação muda — nada de aviso repetido a cada atualização da tela.
 */
export function AlertasSino({ inicial }: { inicial: ResumoAlertas }) {
  const [resumo, setResumo] = useState(inicial);
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/alertas/resumo", { cache: "no-store" });
        const dados = (await res.json()) as ResumoAlertas & { ok: boolean };
        if (dados.ok) setResumo(dados);
      } catch {
        // silencioso: o próximo ciclo tenta de novo.
      }
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const total = resumo.relevantes;
  const cor = resumo.criticos > 0 ? "bg-red-600" : "bg-amber-500";
  const rotuloBotao = total === 0 ? "Alertas: nenhum aberto" : `Alertas: ${resumo.criticos} críticos e ${resumo.atencao} de atenção abertos`;
  const agora = Date.now();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        title="Alertas"
        aria-label={rotuloBotao}
        aria-expanded={aberto}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
      >
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17v.5" />
        </svg>
        {total > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${cor}`}>{total > 99 ? "99+" : total}</span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-11 z-20 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">Alertas</p>
            <p className="text-xs text-neutral-500">
              {total === 0 ? "Nada exige atenção agora." : `${resumo.criticos} ${resumo.criticos === 1 ? "crítico" : "críticos"} · ${resumo.atencao} de atenção`}
              {resumo.resolvidosHoje > 0 ? ` · ${resumo.resolvidosHoje} resolvidos hoje` : ""}
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {resumo.ultimos.map((a) => (
              <Link key={a.id} href={a.destino?.href ?? "/alertas"} onClick={() => setAberto(false)} className="block border-b border-neutral-50 px-4 py-3 last:border-0 hover:bg-neutral-50">
                <div className="flex items-center justify-between gap-2">
                  <SeveridadeBadge severidade={a.severidade} />
                  <span className="text-[11px] text-neutral-400">há {formatDuracao(Math.max(agora - new Date(a.detectadoEm).getTime(), 0))}</span>
                </div>
                <p className="mt-1 truncate text-sm font-medium text-neutral-900">{a.titulo}</p>
                <p className="truncate text-xs text-neutral-500">{[a.pacienteNome ?? a.telefone ?? a.contextoExtra, a.canalNome].filter(Boolean).join(" · ") || "—"}</p>
              </Link>
            ))}
          </div>

          <Link href="/alertas" onClick={() => setAberto(false)} className="block rounded-b-xl border-t border-neutral-100 px-4 py-3 text-center text-sm font-medium text-teal-700 hover:bg-neutral-50">
            Ver todos os alertas
          </Link>
        </div>
      )}
    </div>
  );
}
