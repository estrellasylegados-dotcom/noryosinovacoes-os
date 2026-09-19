"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AlertaView } from "@/lib/alertas-consulta";
import { CATEGORIA_ROTULO, ROTULO_HISTORICO, rotuloResolucao, STATUS_ROTULO, type Categoria } from "@/lib/alertas-tipos";
import { formatDataHora, formatDuracao } from "@/lib/tempo";
import { SeveridadeBadge } from "@/components/alertas/SeveridadeBadge";

const ERRO: Record<string, string> = {
  transicao_invalida: "Este alerta já foi tratado por outra pessoa. Atualizei a tela.",
  forbidden: "Você não tem permissão para esta ação.",
  not_found: "Este alerta não está mais disponível.",
  motivo_muito_longo: "O motivo é longo demais (máximo 300 caracteres).",
};

type Historico = { id: string; evento: string; de: string | null; para: string | null; origem: string; motivo: string | null; quando: string }[];

/** "Estourado há X" / "aberto há X" — sempre calculado contra o `agora` do servidor (mesma hora que o resto da página). */
function tempoEmAberto(a: AlertaView, agora: number): string {
  if (a.tipo === "sla_limite" && a.severidade === "critico" && a.slaAlemDoLimiteMinutos !== null) {
    return `Estourado há ${Math.max(a.slaAlemDoLimiteMinutos, 0)} min`;
  }
  return `Em aberto há ${formatDuracao(Math.max(agora - new Date(a.detectadoEm).getTime(), 0))}`;
}

export function AlertaCard({ alerta, agoraIso, permissoes }: { alerta: AlertaView; agoraIso: string; permissoes: string[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ignorando, setIgnorando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [historico, setHistorico] = useState<Historico | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);

  const agora = new Date(agoraIso).getTime();
  const ativo = alerta.status === "aberto" || alerta.status === "assumido";
  const pode = (p: string) => permissoes.includes(p);
  const pessoa = alerta.pacienteNome ?? alerta.telefone ?? alerta.contextoExtra;

  async function agir(acao: "assumir" | "resolver" | "ignorar") {
    setOcupado(true);
    setErro(null);
    try {
      const res = await fetch(`/api/alertas/${alerta.id}/${acao}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: acao === "ignorar" ? JSON.stringify({ motivo: motivo.trim() || null }) : undefined,
      });
      const dados = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!dados.ok) setErro((dados.error && ERRO[dados.error]) || "Não foi possível concluir a ação agora.");
      else setIgnorando(false);
      router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  async function alternarHistorico() {
    const abrir = !verHistorico;
    setVerHistorico(abrir);
    if (abrir && !historico) {
      const res = await fetch(`/api/alertas/${alerta.id}`, { cache: "no-store" });
      const dados = (await res.json().catch(() => null)) as { ok?: boolean; historico?: Historico } | null;
      setHistorico(dados?.ok && dados.historico ? dados.historico : []);
    }
  }

  const borda = alerta.severidade === "critico" ? "border-l-red-500" : alerta.severidade === "atencao" ? "border-l-amber-500" : "border-l-sky-400";

  return (
    <article className={`rounded-xl border border-neutral-200 border-l-4 bg-white p-4 shadow-sm ${borda} ${ativo ? "" : "opacity-80"}`} aria-label={`${alerta.titulo}${pessoa ? ` — ${pessoa}` : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <SeveridadeBadge severidade={alerta.severidade} />
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">{CATEGORIA_ROTULO[alerta.categoria as Categoria] ?? alerta.categoria}</span>
        {alerta.natureza === "tecnico" && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">Técnico</span>}
        {alerta.status === "assumido" && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800 ring-1 ring-inset ring-teal-200">Assumido{alerta.assumidoPorNome ? ` por ${alerta.assumidoPorNome}` : ""}</span>}
        {!ativo && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">{STATUS_ROTULO[alerta.status]}</span>}
      </div>

      <h3 className="mt-2 text-base font-semibold text-neutral-900">{alerta.titulo}</h3>

      <dl className="mt-1 space-y-0.5 text-sm text-neutral-600">
        {pessoa && (
          <div>
            <dt className="sr-only">Paciente ou contexto</dt>
            <dd className="font-medium text-neutral-800">{pessoa}</dd>
          </div>
        )}
        {alerta.canalNome && (
          <div>
            <dt className="sr-only">Canal</dt>
            <dd>{alerta.canalNome}</dd>
          </div>
        )}
        {alerta.contextoExtra && alerta.pacienteNome && <dd className="text-neutral-500">Etapa: {alerta.contextoExtra}</dd>}
        <div>
          <dt className="inline text-neutral-500">Responsável: </dt>
          <dd className="inline">{alerta.responsavelNome ?? "Equipe (sem responsável)"}</dd>
        </div>
      </dl>

      {alerta.descricao && <p className="mt-2 text-sm text-neutral-600">{alerta.descricao}</p>}

      <p className="mt-2 text-xs font-medium text-neutral-500">
        {ativo ? tempoEmAberto(alerta, agora) : `${alerta.status === "ignorado" ? "Ignorado" : "Resolvido"} em ${formatDataHora(alerta.resolvidoEm ?? alerta.ignoradoEm)}`}
        {!ativo && alerta.status === "resolvido" && ` — ${alerta.resolvidoPorNome ? `${rotuloResolucao(alerta.resolvidoPorEvento)} (${alerta.resolvidoPorNome})` : rotuloResolucao(alerta.resolvidoPorEvento)}`}
        {!ativo && alerta.status === "ignorado" && alerta.ignoradoMotivo ? ` — motivo: ${alerta.ignoradoMotivo}` : ""}
      </p>

      {erro && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {alerta.destino && (
          <Link href={alerta.destino.href} className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
            {alerta.destino.rotulo}
          </Link>
        )}
        {ativo && alerta.status === "aberto" && pode("alertas.assumir") && (
          <button type="button" disabled={ocupado} onClick={() => agir("assumir")} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
            Assumir alerta
          </button>
        )}
        {ativo && pode("alertas.resolver") && (
          <button type="button" disabled={ocupado} onClick={() => agir("resolver")} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
            Resolver
          </button>
        )}
        {ativo && pode("alertas.ignorar") && !ignorando && (
          <button type="button" disabled={ocupado} onClick={() => setIgnorando(true)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-50">
            Ignorar
          </button>
        )}
        <button type="button" onClick={alternarHistorico} aria-expanded={verHistorico} className="ml-auto rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100">
          {verHistorico ? "Ocultar histórico" : "Ver histórico"}
        </button>
      </div>

      {ignorando && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-neutral-50 p-3">
          <label className="sr-only" htmlFor={`motivo-${alerta.id}`}>
            Motivo (opcional)
          </label>
          <input id={`motivo-${alerta.id}`} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional)" className="min-w-0 flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm" />
          <button type="button" disabled={ocupado} onClick={() => agir("ignorar")} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-900 disabled:opacity-50">
            Confirmar
          </button>
          <button type="button" onClick={() => setIgnorando(false)} className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100">
            Cancelar
          </button>
        </div>
      )}

      {verHistorico && (
        <ol className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
          {historico === null && <li>Carregando…</li>}
          {historico?.length === 0 && <li>Sem registros.</li>}
          {historico?.map((h) => (
            <li key={h.id}>
              <span className="font-medium text-neutral-800">{ROTULO_HISTORICO[h.evento] ?? h.evento}</span>
              {h.de && h.para ? ` (${h.de} → ${h.para})` : ""} · {formatDataHora(h.quando)} · {h.origem === "usuario" ? "por pessoa" : "automático"}
              {h.motivo ? ` — ${h.motivo === "manual" ? "manual" : rotuloResolucao(h.motivo) !== "encerrado" ? rotuloResolucao(h.motivo) : h.motivo}` : ""}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
