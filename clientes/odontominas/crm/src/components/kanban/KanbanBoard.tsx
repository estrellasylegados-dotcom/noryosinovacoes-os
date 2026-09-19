"use client";

import { useCallback, useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import type { BoardKanban, Estagio } from "@/lib/kanban";
import { filtrarCards, podeMoverCard, tempoNoEstagioMs, type CardKanban, type FiltrosKanban, type SlaKanban } from "@/lib/kanban-regras";
import type { Permissao } from "@/lib/permissoes";
import { formatDuracao } from "@/lib/tempo";
import { KanbanPainel } from "@/components/kanban/KanbanPainel";
import { ModalPerdido } from "@/components/kanban/ModalPerdido";

type Opcao = { id: string; nome: string };

const SLA_VISUAL: Record<SlaKanban, { icone: string; rotulo: string; classe: string }> = {
  ok: { icone: "🟢", rotulo: "SLA ok", classe: "text-emerald-700" },
  warning: { icone: "🟡", rotulo: "SLA em alerta", classe: "text-amber-700" },
  breached: { icone: "🔴", rotulo: "SLA estourado", classe: "text-red-700" },
  paused: { icone: "⏸", rotulo: "SLA pausado", classe: "text-neutral-500" },
  not_configured: { icone: "⚪", rotulo: "SLA não configurado", classe: "text-neutral-400" },
};

const AVISO_CONFLITO = "Este card foi atualizado por outro usuário. Recarreguei o quadro.";

function novaChave(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function CardVisual({ card, agora, arrastando = false, onAbrir }: { card: CardKanban; agora: number; arrastando?: boolean; onAbrir?: () => void }) {
  const sla = card.sla ? SLA_VISUAL[card.sla] : null;
  const tags = card.etiquetas.slice(0, 3);
  const ultima = card.ultimaInteracaoEm ? formatDuracao(agora - new Date(card.ultimaInteracaoEm).getTime()) : null;
  return (
    <div
      onClick={onAbrir}
      className={`cursor-pointer rounded-lg border border-neutral-200 bg-white p-3 text-left shadow-sm transition hover:border-teal-400 ${arrastando ? "rotate-1 shadow-lg" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-900">{card.pacienteNome || card.telefone || "Sem nome"}</p>
        {card.naoLidas > 0 && <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">{card.naoLidas}</span>}
      </div>
      {card.interesse && <p className="text-xs text-neutral-600">{card.interesse}</p>}
      <p className="mt-1.5 text-xs text-neutral-500">
        {card.canalNome ?? "Sem canal"} · {card.responsavelNome ?? "Sem responsável"}
      </p>
      {(card.origem || tags.length > 0) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {card.origem && <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">{card.origem}</span>}
          {tags.map((t) => (
            <span key={t.id} className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: t.cor }}>
              {t.nome}
            </span>
          ))}
          {card.etiquetas.length > tags.length && <span className="text-[11px] text-neutral-400">+{card.etiquetas.length - tags.length}</span>}
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
        {sla ? <span className={`font-medium ${sla.classe}`}>{sla.icone} {sla.rotulo}</span> : <span />}
        <span title="Última mensagem da conversa">{ultima ? `há ${ultima}` : "sem mensagens"}</span>
      </div>
      {card.status === "lost" && card.motivoPerda && <p className="mt-1 text-[11px] text-neutral-500">Motivo: {card.motivoPerda}</p>}
    </div>
  );
}

function CardArrastavel({ card, agora, podeArrastar, onAbrir }: { card: CardKanban; agora: number; podeArrastar: boolean; onAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, disabled: !podeArrastar });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={`touch-manipulation ${isDragging ? "opacity-30" : ""}`}>
      <CardVisual card={card} agora={agora} onAbrir={onAbrir} />
    </div>
  );
}

function Coluna({ estagio, cards, agora, podeMoverPeloCard, onAbrir }: { estagio: Estagio; cards: CardKanban[]; agora: number; podeMoverPeloCard: (c: CardKanban) => boolean; onAbrir: (c: CardKanban) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: estagio.id });
  return (
    <section className="flex w-[268px] shrink-0 flex-col rounded-xl bg-neutral-100/80">
      <header className="flex items-center justify-between gap-2 px-3 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: estagio.cor ?? "#9ca3af" }} />
          {estagio.nome}
        </h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-neutral-600">{cards.length}</span>
      </header>
      <div ref={setNodeRef} className={`flex min-h-24 flex-1 flex-col gap-2 rounded-b-xl px-2 pb-2 transition ${isOver ? "bg-teal-50 ring-2 ring-teal-400" : ""}`}>
        {cards.map((c) => (
          <CardArrastavel key={c.id} card={c} agora={agora} podeArrastar={podeMoverPeloCard(c)} onAbrir={() => onAbrir(c)} />
        ))}
        {cards.length === 0 && <p className="px-1 py-4 text-center text-xs text-neutral-400">Nenhum card</p>}
      </div>
    </section>
  );
}

export function KanbanBoard({
  boardInicial,
  atendentes,
  canais,
  etiquetas,
  permissoes,
  atendenteId,
}: {
  boardInicial: BoardKanban;
  atendentes: Opcao[];
  canais: Opcao[];
  etiquetas: { id: string; nome: string; cor: string }[];
  permissoes: Permissao[];
  atendenteId: string;
}) {
  const [board, setBoard] = useState(boardInicial);
  const [filtros, setFiltros] = useState<FiltrosKanban>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [arrastando, setArrastando] = useState<CardKanban | null>(null);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [perdendo, setPerdendo] = useState<{ card: CardKanban; estagioId: string } | null>(null);
  const agora = Date.now();

  const ator = useMemo(() => ({ atendenteId, permissoes: new Set(permissoes) }), [atendenteId, permissoes]);
  const podeMoverPeloCard = useCallback((c: CardKanban) => podeMoverCard(ator, c.responsavelId), [ator]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }));

  const recarregar = useCallback(async (mensagem?: string) => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/kanban?pipeline=${board.pipeline.id}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.ok) setBoard(json as BoardKanban);
      else setAviso("Não consegui atualizar o quadro agora.");
      if (mensagem) setAviso(mensagem);
    } catch {
      setAviso("Não consegui atualizar o quadro agora.");
    } finally {
      setCarregando(false);
    }
  }, [board.pipeline.id]);

  const visiveis = useMemo(() => filtrarCards(board.cards, filtros), [board.cards, filtros]);
  const porEstagio = useMemo(() => {
    const m = new Map<string, CardKanban[]>();
    for (const e of board.estagios) m.set(e.id, []);
    for (const c of visiveis) m.get(c.estagioId)?.push(c);
    return m;
  }, [visiveis, board.estagios]);
  const origens = useMemo(() => [...new Set(board.cards.map((c) => c.origem).filter((o): o is string => !!o))].sort(), [board.cards]);
  const estagioPorId = useMemo(() => new Map(board.estagios.map((e) => [e.id, e])), [board.estagios]);

  /** Move com versão esperada; otimista, mas o backend decide (409 → recarrega e avisa). */
  const mover = useCallback(
    async (card: CardKanban, estagioId: string, extra: { motivoPerdaId?: string; observacao?: string } = {}) => {
      const destino = estagioPorId.get(estagioId);
      if (!destino || destino.id === card.estagioId) return;
      const anterior = board;
      setBoard((b) => ({ ...b, cards: b.cards.map((c) => (c.id === card.id ? { ...c, estagioId, status: destino.tipo, estagioEntrouEm: new Date().toISOString() } : c)) }));
      setAviso(null);
      try {
        const res = await fetch(`/api/kanban/oportunidades/${card.id}/mover`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stageId: estagioId, expectedVersion: card.versao, idempotencyKey: novaChave(), ...extra }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.ok) {
          await recarregar();
          return;
        }
        setBoard(anterior);
        if (res.status === 409) await recarregar(AVISO_CONFLITO);
        else if (res.status === 403) setAviso("Você não tem permissão para mover este card.");
        else if (json.error === "motivo_obrigatorio") setAviso("Informe o motivo da perda.");
        else setAviso("Não consegui mover o card. Tente de novo.");
      } catch {
        setBoard(anterior);
        setAviso("Sem conexão. O card não foi movido.");
      }
    },
    [board, estagioPorId, recarregar]
  );

  const pedirMover = useCallback(
    (card: CardKanban, estagioId: string) => {
      const destino = estagioPorId.get(estagioId);
      if (!destino || destino.id === card.estagioId) return;
      if (destino.tipo === "lost") setPerdendo({ card, estagioId });
      else void mover(card, estagioId);
    },
    [estagioPorId, mover]
  );

  function aoIniciar(e: DragStartEvent) {
    setArrastando(board.cards.find((c) => c.id === e.active.id) ?? null);
  }
  function aoSoltar(e: DragEndEvent) {
    setArrastando(null);
    const card = board.cards.find((c) => c.id === e.active.id);
    if (card && e.over) pedirMover(card, String(e.over.id));
  }

  const setF = (p: Partial<FiltrosKanban>) => setFiltros((f) => ({ ...f, ...p }));
  const cardAberto = abertoId ? board.cards.find((c) => c.id === abertoId) ?? null : null;
  const temFiltro = Object.values(filtros).some((v) => (Array.isArray(v) ? v.length > 0 : !!v));
  const selecao = "rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-700";

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-4 sm:px-6">
        <h1 className="mr-2 text-xl font-semibold text-neutral-900">Kanban</h1>
        {board.pipelines.length > 1 && (
          <select className={selecao} value={board.pipeline.id} onChange={(e) => window.location.assign(`/kanban?pipeline=${e.target.value}`)} aria-label="Pipeline">
            {board.pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        )}
        <input className={`${selecao} w-52`} placeholder="Buscar nome, telefone, interesse" value={filtros.busca ?? ""} onChange={(e) => setF({ busca: e.target.value })} aria-label="Buscar" />
        <select className={selecao} value={filtros.responsavelId ?? ""} onChange={(e) => setF({ responsavelId: e.target.value || undefined })} aria-label="Responsável">
          <option value="">Todos os responsáveis</option>
          <option value="sem">Sem responsável</option>
          {atendentes.map((a) => (
            <option key={a.id} value={a.id}>{a.nome}</option>
          ))}
        </select>
        <select className={selecao} value={filtros.canalId ?? ""} onChange={(e) => setF({ canalId: e.target.value || undefined })} aria-label="Canal">
          <option value="">Todos os canais</option>
          {canais.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        <select className={selecao} value={filtros.etiquetaIds?.[0] ?? ""} onChange={(e) => setF({ etiquetaIds: e.target.value ? [e.target.value] : undefined })} aria-label="Tag">
          <option value="">Todas as tags</option>
          {etiquetas.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>
        <select className={selecao} value={filtros.origem ?? ""} onChange={(e) => setF({ origem: e.target.value || undefined })} aria-label="Origem">
          <option value="">Todas as origens</option>
          {origens.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <input className={`${selecao} w-36`} placeholder="Interesse" value={filtros.interesse ?? ""} onChange={(e) => setF({ interesse: e.target.value })} aria-label="Interesse" />
        <select className={selecao} value={filtros.sla ?? ""} onChange={(e) => setF({ sla: (e.target.value || undefined) as SlaKanban | undefined })} aria-label="SLA">
          <option value="">Qualquer SLA</option>
          {(Object.keys(SLA_VISUAL) as SlaKanban[]).map((s) => (
            <option key={s} value={s}>{SLA_VISUAL[s].rotulo}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          de
          <input type="date" className={selecao} onChange={(e) => setF({ de: e.target.value ? `${e.target.value}T00:00:00-03:00` : undefined })} />
          até
          <input type="date" className={selecao} onChange={(e) => setF({ ate: e.target.value ? `${e.target.value}T23:59:59-03:00` : undefined })} />
        </label>
        {temFiltro && (
          <button type="button" onClick={() => setFiltros({})} className="text-sm font-medium text-teal-700 hover:underline">
            Limpar filtros
          </button>
        )}
        <button type="button" onClick={() => void recarregar()} disabled={carregando} className="ml-auto rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
          {carregando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {aviso && (
        <div role="alert" className="mx-4 mb-2 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-600/20 sm:mx-6">
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} className="text-amber-700 hover:underline">fechar</button>
        </div>
      )}
      {board.truncado && <p className="mx-4 mb-2 text-xs text-neutral-500 sm:mx-6">Mostrando os cards mais recentes; use os filtros para achar os demais.</p>}

      <DndContext sensors={sensors} onDragStart={aoIniciar} onDragEnd={aoSoltar} onDragCancel={() => setArrastando(null)}>
        <div className="flex flex-1 items-start gap-3 overflow-x-auto px-4 pb-6 sm:px-6">
          {board.estagios.map((e) => (
            <Coluna key={e.id} estagio={e} cards={porEstagio.get(e.id) ?? []} agora={agora} podeMoverPeloCard={podeMoverPeloCard} onAbrir={(c) => setAbertoId(c.id)} />
          ))}
        </div>
        <DragOverlay>{arrastando ? <CardVisual card={arrastando} agora={agora} arrastando /> : null}</DragOverlay>
      </DndContext>

      {cardAberto && (
        <KanbanPainel
          key={cardAberto.id + cardAberto.versao}
          card={cardAberto}
          estagios={board.estagios}
          atendentes={atendentes}
          podeMover={podeMoverPeloCard(cardAberto)}
          tempoNoEstagio={formatDuracao(tempoNoEstagioMs(cardAberto.estagioEntrouEm, new Date(agora)))}
          onFechar={() => setAbertoId(null)}
          onMover={(estagioId) => pedirMover(cardAberto, estagioId)}
          onAtualizado={() => void recarregar()}
          onConflito={() => void recarregar(AVISO_CONFLITO)}
        />
      )}

      {perdendo && (
        <ModalPerdido
          motivos={board.motivosPerda}
          onCancelar={() => setPerdendo(null)}
          onConfirmar={(motivoPerdaId, observacao) => {
            const p = perdendo;
            setPerdendo(null);
            void mover(p.card, p.estagioId, { motivoPerdaId, observacao });
          }}
        />
      )}
    </div>
  );
}
