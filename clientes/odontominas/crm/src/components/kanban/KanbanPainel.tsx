"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DetalheOportunidade, Estagio } from "@/lib/kanban";
import type { CardKanban } from "@/lib/kanban-regras";
import { formatDataHora, formatTelefone } from "@/lib/tempo";

type Opcao = { id: string; nome: string };

/**
 * Painel lateral do card: NÃO duplica a ficha do paciente nem o Chat — mostra o
 * resumo comercial, permite mover/converter/atribuir e liga pra onde o detalhe
 * completo já mora (/pacientes/[id], /chat). Também é o caminho de mover no
 * celular (arrastar no toque é o atalho, este select é o caminho garantido).
 */
export function KanbanPainel({
  card,
  estagios,
  atendentes,
  podeMover,
  tempoNoEstagio,
  onFechar,
  onMover,
  onAtualizado,
  onConflito,
}: {
  card: CardKanban;
  estagios: Estagio[];
  atendentes: Opcao[];
  podeMover: boolean;
  tempoNoEstagio: string;
  onFechar: () => void;
  onMover: (estagioId: string) => void;
  onAtualizado: () => void;
  onConflito: () => void;
}) {
  const [detalhe, setDetalhe] = useState<DetalheOportunidade | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [interesse, setInteresse] = useState(card.interesse ?? "");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/kanban/oportunidades/${card.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return;
        if (j.ok) setDetalhe(j as DetalheOportunidade);
        else setErro("Não consegui carregar o histórico.");
      })
      .catch(() => vivo && setErro("Não consegui carregar o histórico."));
    return () => {
      vivo = false;
    };
  }, [card.id, card.versao]);

  const nomeEstagio = (id: string | null) => estagios.find((e) => e.id === id)?.nome ?? "—";

  async function converter() {
    setSalvando(true);
    setErro(null);
    const res = await fetch(`/api/kanban/oportunidades/${card.id}/converter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: card.versao, idempotencyKey: crypto.randomUUID() }),
    }).catch(() => null);
    setSalvando(false);
    if (res?.ok) onAtualizado();
    else if (res?.status === 409) onConflito();
    else setErro("Não consegui converter agora.");
  }

  async function patch(corpo: Record<string, unknown>) {
    setSalvando(true);
    setErro(null);
    const res = await fetch(`/api/kanban/oportunidades/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    }).catch(() => null);
    setSalvando(false);
    if (res?.ok) onAtualizado();
    else if (res?.status === 409) onConflito();
    else setErro("Não consegui salvar agora.");
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onFechar}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()} aria-label="Detalhes da oportunidade">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{card.pacienteNome || "Sem nome"}</h2>
            {card.telefone && <p className="text-sm text-neutral-500">{formatTelefone(card.telefone)}</p>}
          </div>
          <button type="button" onClick={onFechar} className="rounded-lg px-2 py-1 text-neutral-500 hover:bg-neutral-100" aria-label="Fechar">✕</button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href={`/pacientes/${card.pacienteId}`} className="font-medium text-teal-700 hover:underline">Ficha do paciente</Link>
          {card.conversaId && <Link href="/chat" className="font-medium text-teal-700 hover:underline">Abrir Chat ao Vivo</Link>}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div><dt className="text-xs text-neutral-500">Canal</dt><dd>{card.canalNome ?? "—"}</dd></div>
          <div><dt className="text-xs text-neutral-500">Origem</dt><dd>{card.origem ?? "—"}</dd></div>
          <div><dt className="text-xs text-neutral-500">Status da conversa</dt><dd>{card.statusConversa ?? "—"}</dd></div>
          <div><dt className="text-xs text-neutral-500">No estágio há</dt><dd>{tempoNoEstagio}</dd></div>
        </dl>

        {card.etiquetas.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {card.etiquetas.map((t) => (
              <span key={t.id} className="rounded px-1.5 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: t.cor }}>{t.nome}</span>
            ))}
          </div>
        )}

        <div className="mt-5 space-y-3 rounded-lg bg-neutral-50 p-3">
          <label className="block text-sm font-medium text-neutral-700">
            Estágio
            <select
              disabled={!podeMover || salvando}
              value={card.estagioId}
              onChange={(e) => onMover(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm disabled:opacity-60"
            >
              {estagios.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-neutral-700">
            Responsável
            <select
              disabled={!podeMover || salvando}
              value={card.responsavelId ?? ""}
              onChange={(e) => void patch({ responsavelId: e.target.value || null, responsavelEsperadoId: card.responsavelId })}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm disabled:opacity-60"
            >
              <option value="">Sem responsável</option>
              {atendentes.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-neutral-700">
            Interesse / tratamento
            <div className="mt-1 flex gap-2">
              <input
                value={interesse}
                disabled={!podeMover}
                maxLength={120}
                onChange={(e) => setInteresse(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-2 text-sm disabled:opacity-60"
                placeholder="Ex.: Implante"
              />
              <button type="button" disabled={!podeMover || salvando || interesse === (card.interesse ?? "")} onClick={() => void patch({ interesse })} className="rounded-lg bg-teal-700 px-3 text-sm font-medium text-white disabled:opacity-40">
                Salvar
              </button>
            </div>
          </label>

          {podeMover && card.status === "open" && (
            <button type="button" disabled={salvando} onClick={() => void converter()} className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              Marcar como convertido
            </button>
          )}
          {!podeMover && <p className="text-xs text-neutral-500">Você pode visualizar este card, mas não movê-lo.</p>}
        </div>

        {card.status === "lost" && card.motivoPerda && <p className="mt-3 text-sm text-neutral-600">Perdido: {card.motivoPerda}</p>}
        {erro && <p role="alert" className="mt-3 text-sm text-red-600">{erro}</p>}

        <h3 className="mt-6 text-sm font-semibold text-neutral-800">Histórico</h3>
        {!detalhe && !erro && <p className="mt-2 text-sm text-neutral-400">Carregando…</p>}
        <ol className="mt-2 space-y-3 border-l border-neutral-200 pl-4">
          {[...(detalhe?.historico ?? [])].reverse().map((h) => (
            <li key={h.id} className="relative text-sm">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-teal-600" />
              <p className="text-xs text-neutral-400">{formatDataHora(h.em)}{h.atorNome ? ` · ${h.atorNome}` : ""}{h.origem !== "manual" ? ` · ${h.origem}` : ""}</p>
              {h.tipo === "created" && <p className="text-neutral-800">Criada em {nomeEstagio(h.estagioPara)}</p>}
              {h.tipo === "stage_changed" && (
                <p className="text-neutral-800">
                  {nomeEstagio(h.estagioDe)} → <strong>{nomeEstagio(h.estagioPara)}</strong>
                  {h.motivoPerda && <span className="text-neutral-500"> — {h.motivoPerda}</span>}
                </p>
              )}
              {h.tipo === "owner_changed" && <p className="text-neutral-800">Responsável: {h.responsavelDe ?? "ninguém"} → <strong>{h.responsavelPara ?? "ninguém"}</strong></p>}
              {h.observacao && <p className="text-xs text-neutral-500">“{h.observacao}”</p>}
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
