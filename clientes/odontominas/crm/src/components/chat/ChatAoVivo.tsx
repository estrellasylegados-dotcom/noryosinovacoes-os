"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Atendente } from "@/lib/atendentes";
import {
  contarAbasChat,
  filtrarConversasChat,
  type AbaChat,
  type ConversaChat,
  type MensagemChat,
} from "@/lib/chat";
import type { Etiqueta } from "@/lib/etiquetas";
import { PRIORIDADE_CONFIG, PRIORIDADE_ORDEM, type Prioridade } from "@/lib/prioridade";
import { STATUS_CONFIG, STATUS_ORDEM, type StatusConversa } from "@/lib/status";
import { formatHoraCurta, formatTelefone } from "@/lib/tempo";

const INTERVALO_LISTA_MS = 8000;
const INTERVALO_THREAD_MS = 4000;

const ABAS: { valor: AbaChat; label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "nao_lidas", label: "Não lidas" },
  { valor: "concluidos", label: "Concluídos" },
  { valor: "atribuidos", label: "Atribuídos" },
  { valor: "arquivadas", label: "Arquivadas" },
];

const CORES_AVATAR = ["bg-teal-600", "bg-blue-600", "bg-violet-600", "bg-rose-600", "bg-amber-600", "bg-emerald-600"];

function corAvatar(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return CORES_AVATAR[hash % CORES_AVATAR.length];
}

function iniciais(nome: string | null, telefone: string): string {
  if (nome) {
    const partes = nome.trim().split(/\s+/);
    return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
  }
  return telefone.slice(-2);
}

function Avatar({ nome, telefone }: { nome: string | null; telefone: string }) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${corAvatar(
        nome || telefone
      )}`}
    >
      {iniciais(nome, telefone)}
    </div>
  );
}

async function chamarApi<T = { ok: boolean; error?: string }>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const resposta = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  return (await resposta.json()) as T;
}

export function ChatAoVivo({
  conversasIniciais,
  etiquetasIniciais,
  atendentes,
  atendenteAtualId,
}: {
  conversasIniciais: ConversaChat[];
  etiquetasIniciais: Etiqueta[];
  atendentes: Atendente[];
  atendenteAtualId: string | null;
}) {
  const [conversas, setConversas] = useState(conversasIniciais);
  const [etiquetas, setEtiquetas] = useState(etiquetasIniciais);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaChat>("todos");
  const [busca, setBusca] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState<Prioridade | "">("");
  const [filtroEtiquetaId, setFiltroEtiquetaId] = useState("");

  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const [textoResposta, setTextoResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const [mostrarNovaConversa, setMostrarNovaConversa] = useState(false);
  const [mostrarEtiquetaPopover, setMostrarEtiquetaPopover] = useState(false);
  const [novoNomeEtiqueta, setNovoNomeEtiqueta] = useState("");

  const fimDaThreadRef = useRef<HTMLDivElement>(null);

  const contagens = useMemo(() => contarAbasChat(conversas, atendenteAtualId), [conversas, atendenteAtualId]);
  const conversasFiltradas = useMemo(
    () =>
      filtrarConversasChat(conversas, {
        aba,
        atendenteIdAtual: atendenteAtualId,
        prioridade: filtroPrioridade || null,
        etiquetaId: filtroEtiquetaId || null,
        busca,
      }),
    [conversas, aba, atendenteAtualId, filtroPrioridade, filtroEtiquetaId, busca]
  );

  const selecionada = conversas.find((c) => c.id === selecionadaId) ?? null;

  async function atualizarListaAgora() {
    const dados = await chamarApi<{ ok: boolean; conversas?: ConversaChat[] }>("/api/chat/conversas");
    if (dados.ok && dados.conversas) setConversas(dados.conversas);
  }

  // Lista: carga inicial já veio do servidor, então só faz polling a partir daqui.
  useEffect(() => {
    const id = setInterval(atualizarListaAgora, INTERVALO_LISTA_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selecionadaId) {
      setMensagens([]);
      return;
    }

    let cancelado = false;
    async function carregar(mostrarLoading: boolean) {
      if (mostrarLoading) setCarregandoMensagens(true);
      const dados = await chamarApi<{ ok: boolean; mensagens?: MensagemChat[] }>(
        `/api/chat/conversas/${selecionadaId}/mensagens`
      );
      if (!cancelado && dados.ok && dados.mensagens) setMensagens(dados.mensagens);
      if (mostrarLoading) setCarregandoMensagens(false);
    }

    carregar(true);
    const id = setInterval(() => carregar(false), INTERVALO_THREAD_MS);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [selecionadaId]);

  useEffect(() => {
    fimDaThreadRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens, selecionadaId]);

  function selecionarConversa(c: ConversaChat) {
    setSelecionadaId(c.id);
    setErroEnvio(null);
    if (c.naoLida) {
      setConversas((prev) => prev.map((x) => (x.id === c.id ? { ...x, naoLida: false } : x)));
      chamarApi(`/api/chat/conversas/${c.id}`, { method: "PATCH", body: JSON.stringify({ naoLida: false }) });
    }
  }

  async function enviarResposta() {
    if (!selecionada || !textoResposta.trim() || enviando) return;
    setEnviando(true);
    setErroEnvio(null);

    const resultado = await chamarApi<{ ok: boolean; error?: string; mensagem?: MensagemChat }>(
      `/api/chat/conversas/${selecionada.id}/mensagens`,
      { method: "POST", body: JSON.stringify({ texto: textoResposta }) }
    );

    if (!resultado.ok) {
      setErroEnvio(
        resultado.error === "evolution_unavailable"
          ? "WhatsApp não está conectado agora."
          : "Não consegui enviar, tenta de novo."
      );
      setEnviando(false);
      return;
    }

    if (resultado.mensagem) setMensagens((prev) => [...prev, resultado.mensagem!]);
    setTextoResposta("");
    setEnviando(false);
    atualizarListaAgora();
  }

  async function patchSelecionada(patch: Record<string, unknown>) {
    if (!selecionada) return;
    setConversas((prev) => prev.map((c) => (c.id === selecionada.id ? { ...c, ...otimista(patch, atendentes) } : c)));
    await chamarApi(`/api/chat/conversas/${selecionada.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    atualizarListaAgora();
  }

  async function mudarStatus(status: StatusConversa) {
    if (!selecionada) return;
    setConversas((prev) => prev.map((c) => (c.id === selecionada.id ? { ...c, status } : c)));
    await chamarApi(`/api/conversas/${selecionada.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    atualizarListaAgora();
  }

  async function adicionarEtiquetaNaSelecionada(etiquetaId: string) {
    if (!selecionada) return;
    const etiqueta = etiquetas.find((e) => e.id === etiquetaId);
    if (!etiqueta) return;
    setConversas((prev) =>
      prev.map((c) => (c.id === selecionada.id ? { ...c, etiquetas: [...c.etiquetas, etiqueta] } : c))
    );
    await chamarApi(`/api/chat/conversas/${selecionada.id}/etiquetas`, {
      method: "POST",
      body: JSON.stringify({ etiquetaId }),
    });
  }

  async function removerEtiquetaDaSelecionada(etiquetaId: string) {
    if (!selecionada) return;
    setConversas((prev) =>
      prev.map((c) =>
        c.id === selecionada.id ? { ...c, etiquetas: c.etiquetas.filter((e) => e.id !== etiquetaId) } : c
      )
    );
    await chamarApi(`/api/chat/conversas/${selecionada.id}/etiquetas?etiquetaId=${etiquetaId}`, { method: "DELETE" });
  }

  async function criarEtiquetaNova() {
    const nome = novoNomeEtiqueta.trim();
    if (!nome) return;
    const resultado = await chamarApi<{ ok: boolean; etiqueta?: Etiqueta; error?: string }>("/api/chat/etiquetas", {
      method: "POST",
      body: JSON.stringify({ nome }),
    });
    if (resultado.ok && resultado.etiqueta) {
      setEtiquetas((prev) => [...prev, resultado.etiqueta!]);
      setNovoNomeEtiqueta("");
      if (selecionada) adicionarEtiquetaNaSelecionada(resultado.etiqueta.id);
    }
  }

  return (
    <div className="flex h-[calc(100vh-1px)] min-h-0 sm:h-screen">
      <section
        className={`flex w-full min-w-0 flex-col border-r border-neutral-200 bg-white sm:w-[360px] sm:shrink-0 ${
          selecionadaId ? "hidden sm:flex" : "flex"
        }`}
      >
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Chat ao Vivo</h1>
            <p className="text-xs text-neutral-500">OdontoMinas · WhatsApp</p>
          </div>
          <button
            type="button"
            title="Nova conversa"
            onClick={() => setMostrarNovaConversa(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-700 text-lg font-medium text-white hover:bg-teal-800"
          >
            +
          </button>
        </header>

        <div className="border-b border-neutral-200 px-4 py-3">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar conversa (mín. 3 letras)..."
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-neutral-200 px-4 py-3">
          {ABAS.map((item) => (
            <button
              key={item.valor}
              type="button"
              onClick={() => setAba(item.valor)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                aba === item.valor ? "bg-teal-700 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {item.label} <span className="opacity-70">{contagens[item.valor === "arquivadas" ? "arquivadas" : item.valor]}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2 border-b border-neutral-200 px-4 py-2">
          <select
            value={filtroPrioridade}
            onChange={(e) => setFiltroPrioridade(e.target.value as Prioridade | "")}
            className="flex-1 rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-600 outline-none"
          >
            <option value="">Toda prioridade</option>
            {PRIORIDADE_ORDEM.map((p) => (
              <option key={p} value={p}>
                {PRIORIDADE_CONFIG[p].label}
              </option>
            ))}
          </select>
          <select
            value={filtroEtiquetaId}
            onChange={(e) => setFiltroEtiquetaId(e.target.value)}
            className="flex-1 rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-600 outline-none"
          >
            <option value="">Toda etiqueta</option>
            {etiquetas.map((et) => (
              <option key={et.id} value={et.id}>
                {et.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversasFiltradas.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-neutral-400">Nenhuma conversa aqui.</p>
          )}
          {conversasFiltradas.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selecionarConversa(c)}
              className={`flex w-full items-start gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors hover:bg-neutral-50 ${
                selecionadaId === c.id ? "bg-teal-50" : ""
              }`}
            >
              <Avatar nome={c.pacienteNome} telefone={c.telefone} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-sm ${c.naoLida ? "font-semibold text-neutral-900" : "font-medium text-neutral-700"}`}>
                    {c.pacienteNome || formatTelefone(c.telefone)}
                  </p>
                  <span className="shrink-0 text-[11px] text-neutral-400">{formatHoraCurta(c.ultimaMensagemEm)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORIDADE_CONFIG[c.prioridade].corPonto}`} />
                  <p className={`truncate text-xs ${c.naoLida ? "font-medium text-neutral-700" : "text-neutral-500"}`}>
                    {c.ultimaMensagemDirecao === "enviada" ? "Você: " : ""}
                    {c.ultimaMensagemPreview ?? "Sem mensagens ainda"}
                  </p>
                  {c.naoLida && <span className="h-2 w-2 shrink-0 rounded-full bg-teal-600" />}
                </div>
                {c.etiquetas.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.etiquetas.slice(0, 3).map((et) => (
                      <span
                        key={et.id}
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: et.cor }}
                      >
                        {et.nome}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className={`min-h-0 min-w-0 flex-1 flex-col bg-neutral-50 ${selecionadaId ? "flex" : "hidden sm:flex"}`}>
        {!selecionada ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-neutral-400">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-2xl">💬</div>
            <p className="text-sm font-medium text-neutral-500">Selecione uma conversa</p>
            <p className="text-xs">Escolha uma conversa à esquerda pra começar</p>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
              <button
                type="button"
                onClick={() => setSelecionadaId(null)}
                className="text-sm text-teal-700 sm:hidden"
              >
                ← Voltar
              </button>
              <Avatar nome={selecionada.pacienteNome} telefone={selecionada.telefone} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {selecionada.pacienteNome || "Sem nome"}
                </p>
                <p className="text-xs text-neutral-500">{formatTelefone(selecionada.telefone)}</p>
              </div>

              <select
                value={selecionada.status}
                onChange={(e) => mudarStatus(e.target.value as StatusConversa)}
                className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_CONFIG[selecionada.status].corBadge}`}
              >
                {STATUS_ORDEM.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </option>
                ))}
              </select>

              <select
                value={selecionada.prioridade}
                onChange={(e) => patchSelecionada({ prioridade: e.target.value })}
                className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${PRIORIDADE_CONFIG[selecionada.prioridade].corBadge}`}
              >
                {PRIORIDADE_ORDEM.map((p) => (
                  <option key={p} value={p}>
                    {PRIORIDADE_CONFIG[p].label}
                  </option>
                ))}
              </select>

              <select
                value={selecionada.atribuidoAId ?? ""}
                onChange={(e) => patchSelecionada({ atribuidoAId: e.target.value || null })}
                className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600"
              >
                <option value="">Não atribuída</option>
                {atendentes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => patchSelecionada({ arquivada: !selecionada.arquivada })}
                className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
              >
                {selecionada.arquivada ? "Desarquivar" : "Arquivar"}
              </button>

              <div className="relative flex flex-wrap items-center gap-1">
                {selecionada.etiquetas.map((et) => (
                  <span
                    key={et.id}
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: et.cor }}
                  >
                    {et.nome}
                    <button type="button" onClick={() => removerEtiquetaDaSelecionada(et.id)} className="opacity-80 hover:opacity-100">
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setMostrarEtiquetaPopover((v) => !v)}
                  className="rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-neutral-500 hover:bg-neutral-100"
                >
                  + etiqueta
                </button>
                {mostrarEtiquetaPopover && (
                  <div className="absolute right-0 top-8 z-10 w-56 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
                    {etiquetas
                      .filter((et) => !selecionada.etiquetas.some((se) => se.id === et.id))
                      .map((et) => (
                        <button
                          key={et.id}
                          type="button"
                          onClick={() => {
                            adicionarEtiquetaNaSelecionada(et.id);
                            setMostrarEtiquetaPopover(false);
                          }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-neutral-50"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: et.cor }} />
                          {et.nome}
                        </button>
                      ))}
                    <div className="mt-1 flex gap-1 border-t border-neutral-100 pt-2">
                      <input
                        type="text"
                        value={novoNomeEtiqueta}
                        onChange={(e) => setNovoNomeEtiqueta(e.target.value)}
                        placeholder="Nova etiqueta"
                        className="min-w-0 flex-1 rounded border border-neutral-200 px-2 py-1 text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={criarEtiquetaNova}
                        className="rounded bg-teal-700 px-2 py-1 text-xs font-medium text-white hover:bg-teal-800"
                      >
                        Criar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {carregandoMensagens && <p className="text-center text-xs text-neutral-400">Carregando…</p>}
              {!carregandoMensagens && mensagens.length === 0 && (
                <p className="text-center text-sm text-neutral-400">Nenhuma mensagem ainda.</p>
              )}
              {mensagens.map((m) => (
                <div key={m.id} className={`flex ${m.direcao === "enviada" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      m.direcao === "enviada" ? "bg-teal-700 text-white" : "border border-neutral-200 bg-white text-neutral-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.conteudo ?? `[${m.tipo}]`}</p>
                    <p className={`mt-1 text-right text-[10px] ${m.direcao === "enviada" ? "text-teal-100" : "text-neutral-400"}`}>
                      {formatHoraCurta(m.quando)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={fimDaThreadRef} />
            </div>

            <div className="border-t border-neutral-200 bg-white px-4 py-3">
              {erroEnvio && <p className="mb-1.5 text-xs text-red-600">{erroEnvio}</p>}
              <div className="flex items-end gap-2">
                <textarea
                  value={textoResposta}
                  onChange={(e) => setTextoResposta(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviarResposta();
                    }
                  }}
                  placeholder="Escreva uma resposta…"
                  rows={1}
                  className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
                <button
                  type="button"
                  disabled={enviando || !textoResposta.trim()}
                  onClick={enviarResposta}
                  className="shrink-0 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {enviando ? "Enviando…" : "Enviar"}
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {mostrarNovaConversa && (
        <NovaConversaModal
          onFechar={() => setMostrarNovaConversa(false)}
          onCriada={(conversaId) => {
            setMostrarNovaConversa(false);
            atualizarListaAgora().then(() => setSelecionadaId(conversaId));
          }}
        />
      )}
    </div>
  );
}

function otimista(patch: Record<string, unknown>, atendentes: Atendente[]) {
  const extra: Record<string, unknown> = { ...patch };
  if ("atribuidoAId" in patch) {
    extra.atribuidoANome = atendentes.find((a) => a.id === patch.atribuidoAId)?.nome ?? null;
  }
  return extra;
}

function NovaConversaModal({ onFechar, onCriada }: { onFechar: () => void; onCriada: (conversaId: string) => void }) {
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    if (!telefone.trim() || !texto.trim() || enviando) return;
    setEnviando(true);
    setErro(null);

    const resultado = await chamarApi<{ ok: boolean; error?: string; conversaId?: string }>("/api/chat/conversas", {
      method: "POST",
      body: JSON.stringify({ telefone, nome: nome || undefined, texto }),
    });

    if (!resultado.ok || !resultado.conversaId) {
      setErro(
        resultado.error === "telefone_invalido"
          ? "Telefone inválido — confira o DDD."
          : resultado.error === "evolution_unavailable"
            ? "WhatsApp não está conectado agora."
            : "Não consegui enviar, tenta de novo."
      );
      setEnviando(false);
      return;
    }

    onCriada(resultado.conversaId);
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h2 className="mb-3 text-base font-semibold text-neutral-900">Nova conversa</h2>

        <label className="mb-2 block text-xs font-medium text-neutral-500">
          Telefone
          <input
            type="text"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(61) 99999-8888"
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </label>

        <label className="mb-2 block text-xs font-medium text-neutral-500">
          Nome (opcional)
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </label>

        <label className="mb-3 block text-xs font-medium text-neutral-500">
          Primeira mensagem
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </label>

        {erro && <p className="mb-2 text-xs text-red-600">{erro}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">
            Cancelar
          </button>
          <button
            type="button"
            disabled={enviando || !telefone.trim() || !texto.trim()}
            onClick={criar}
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
