"use client";

import { useEffect, useRef, useState } from "react";
import type { ContatoTeste } from "@/lib/fluxo-contatos-teste";
import type { EventoExecucao, ExecucaoFluxoResumo } from "@/lib/fluxo-execucoes-consulta";
import type { EstadoExecucao } from "@/lib/fluxo-motor";
import { formatDataHora } from "@/lib/tempo";

const ESTADOS_TERMINAIS: EstadoExecucao[] = ["completed", "cancelled", "failed", "transferred"];
const INTERVALO_POLLING_MS = 2000;

const LABEL_ESTADO: Record<EstadoExecucao, string> = {
  queued: "na fila",
  waiting_time: "aguardando (espera)",
  waiting_input: "aguardando resposta",
  completed: "concluída",
  cancelled: "cancelada",
  failed: "falhou",
  transferred: "transferida pra humano",
};

/**
 * Modo teste do editor: nunca contra população real — o admin escolhe o
 * contato (busca por nome/telefone, `/api/fluxos/contatos-teste`, nunca um
 * número fixo no código) e a execução roda `is_test=true` contra o
 * RASCUNHO atual. Único polling client-side do projeto (todo o resto usa
 * `router.refresh()` pós-ação) — acompanhar uma execução assíncrona
 * passo-a-passo é o valor central deste painel.
 */
export function FluxoPainelTeste({
  fluxoId,
  bloqueadoPorErro,
  historicoInicial,
  onFlushAutosave,
  onExecucaoNoAtualChange,
}: {
  fluxoId: string;
  bloqueadoPorErro: boolean;
  historicoInicial: ExecucaoFluxoResumo[];
  onFlushAutosave: () => Promise<void>;
  onExecucaoNoAtualChange: (noId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [contatos, setContatos] = useState<ContatoTeste[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [contato, setContato] = useState<ContatoTeste | null>(null);
  const [execucaoId, setExecucaoId] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoExecucao | null>(null);
  const [eventos, setEventos] = useState<EventoExecucao[]>([]);
  const [iniciando, setIniciando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
    };
  }, []);

  async function buscar() {
    setBuscando(true);
    try {
      const resposta = await fetch(`/api/fluxos/contatos-teste?q=${encodeURIComponent(query)}`);
      const resultado = (await resposta.json()) as { ok: boolean; contatos?: ContatoTeste[] };
      setContatos(resultado.ok ? (resultado.contatos ?? []) : []);
    } finally {
      setBuscando(false);
    }
  }

  function pararPolling() {
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }
  }

  async function consultarEvento() {
    if (!execucaoId) return;
    const resposta = await fetch(`/api/fluxos/execucoes/${execucaoId}/eventos`);
    const resultado = (await resposta.json()) as {
      ok: boolean;
      execucao?: { estado: EstadoExecucao; noAtualId: string | null; erro: string | null };
      eventos?: EventoExecucao[];
    };
    if (!resultado.ok || !resultado.execucao) return;

    setEstado(resultado.execucao.estado);
    setEventos(resultado.eventos ?? []);
    onExecucaoNoAtualChange(resultado.execucao.noAtualId);

    if (ESTADOS_TERMINAIS.includes(resultado.execucao.estado)) {
      pararPolling();
      if (resultado.execucao.estado === "failed" && resultado.execucao.erro) setErro(resultado.execucao.erro);
    }
  }

  async function iniciarTeste() {
    if (!contato) return;
    setIniciando(true);
    setErro(null);
    try {
      await onFlushAutosave();

      const resposta = await fetch(`/api/fluxos/${fluxoId}/testar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pacienteId: contato.pacienteId, conversaId: contato.conversaId }),
      });
      const resultado = (await resposta.json()) as { ok: boolean; execucaoId?: string; error?: string };
      if (!resultado.ok || !resultado.execucaoId) {
        setErro(resultado.error ?? "não consegui iniciar o teste");
        return;
      }

      setExecucaoId(resultado.execucaoId);
      setEventos([]);
      setEstado("queued");
      pararPolling();
      intervaloRef.current = setInterval(() => void consultarEvento(), INTERVALO_POLLING_MS);
      void consultarEvento();
    } finally {
      setIniciando(false);
    }
  }

  return (
    <div className="space-y-3">
      {bloqueadoPorErro && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Corrija os erros de validação antes de testar.</p>
      )}

      <div>
        <label className="text-xs font-medium text-neutral-600">Contato de teste</label>
        <div className="mt-1 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="nome ou telefone"
            className="flex-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-teal-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={buscar}
            disabled={buscando}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
          >
            Buscar
          </button>
        </div>
        {contatos.length > 0 && (
          <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
            {contatos.map((c) => (
              <button
                key={c.pacienteId}
                type="button"
                onClick={() => setContato(c)}
                className={`block w-full rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                  contato?.pacienteId === c.pacienteId ? "border-teal-600 bg-teal-50" : "border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                {c.nome ?? "(sem nome)"} — {c.telefone}
              </button>
            ))}
          </div>
        )}
        {contato && <p className="mt-1 text-xs text-teal-700">Selecionado: {contato.nome ?? contato.telefone}</p>}
      </div>

      <button
        type="button"
        disabled={!contato || iniciando || bloqueadoPorErro}
        onClick={iniciarTeste}
        className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-900 disabled:opacity-50"
      >
        {iniciando ? "Iniciando…" : "Iniciar teste"}
      </button>

      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}

      {estado && (
        <div>
          <p className="text-xs font-medium text-neutral-600">
            Execução: <span className="font-normal text-neutral-500">{LABEL_ESTADO[estado]}</span>
          </p>
          <ol className="mt-2 space-y-1.5 border-l border-neutral-200 pl-3">
            {eventos.map((evento) => (
              <li key={evento.id} className="text-xs">
                <span className="font-mono text-neutral-400">#{evento.sequencia}</span>{" "}
                <span className="text-neutral-700">{evento.noId}</span>{" "}
                <span className="text-neutral-400">
                  ({evento.tipoEvento}, {evento.status})
                </span>
                {evento.erro && <p className="text-red-600">{evento.erro}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {historicoInicial.length > 0 && (
        <div className="border-t border-neutral-100 pt-3">
          <p className="text-xs font-medium text-neutral-600">Testes anteriores</p>
          <ul className="mt-1.5 space-y-1">
            {historicoInicial.map((execucao) => (
              <li key={execucao.id} className="text-[11px] text-neutral-400">
                {formatDataHora(execucao.createdAt)} — {LABEL_ESTADO[execucao.estado]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
