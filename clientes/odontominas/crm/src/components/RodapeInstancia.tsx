"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Rodapé de ações da instância (página Conexão) — só as que têm função de
 * verdade por trás. A RoiZap mostra 6 ícones (desconectar, editar,
 * atualizar, anunciar, agendar, excluir); aqui "editar apelido",
 * "atualizar status" e "desconectar" existem de verdade — anunciar/agendar
 * ficam de fora, não são funcionalidades que existem no sistema. Botão
 * decorativo sem efeito é pior que não ter o botão. Desconectar derruba a
 * sessão real do WhatsApp (precisa de QR novo pra voltar) — por isso pede
 * confirmação explícita, não executa no primeiro clique.
 */
export function RodapeInstancia({ apelidoAtual, conectado }: { apelidoAtual: string | null; conectado: boolean | null }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [confirmandoDesconexao, setConfirmandoDesconexao] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  function atualizar() {
    setAtualizando(true);
    router.refresh();
    setTimeout(() => setAtualizando(false), 600);
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        >
          <IconeLapis />
          Editar nome
        </button>
        <button
          type="button"
          onClick={atualizar}
          disabled={atualizando}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
        >
          <IconeAtualizar girando={atualizando} />
          Atualizar
        </button>
        {conectado && (
          <button
            type="button"
            onClick={() => setConfirmandoDesconexao(true)}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <IconeDesconectar />
            Desconectar
          </button>
        )}
      </div>

      {editando && <ModalEditarApelido apelidoAtual={apelidoAtual} onFechar={() => setEditando(false)} />}
      {confirmandoDesconexao && <ModalConfirmarDesconexao onFechar={() => setConfirmandoDesconexao(false)} />}
    </>
  );
}

function ModalConfirmarDesconexao({ onFechar }: { onFechar: () => void }) {
  const router = useRouter();
  const [desconectando, setDesconectando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setDesconectando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/conexao/desconectar", { method: "POST" });
      const dados = (await resposta.json()) as { ok: boolean; error?: string };
      if (!dados.ok) throw new Error(dados.error ?? "falhou");

      onFechar();
      router.refresh();
    } catch {
      setErro("Não consegui desconectar, tenta de novo.");
      setDesconectando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h2 className="mb-1 text-base font-semibold text-neutral-900">Desconectar o WhatsApp?</h2>
        <p className="mb-3 text-sm text-neutral-600">
          O atendimento por aqui para até alguém escanear um QR Code novo pra reconectar. Os pacientes
          continuam recebendo suas mensagens normalmente no WhatsApp deles — só o CRM para de
          enviar/receber.
        </p>

        {erro && <p className="mb-2 text-xs text-red-600">{erro}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">
            Cancelar
          </button>
          <button
            type="button"
            disabled={desconectando}
            onClick={confirmar}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {desconectando ? "Desconectando…" : "Desconectar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalEditarApelido({ apelidoAtual, onFechar }: { apelidoAtual: string | null; onFechar: () => void }) {
  const router = useRouter();
  const [nome, setNome] = useState(apelidoAtual ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    setErro(null);

    try {
      const resposta = await fetch("/api/conexao/apelido", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apelido: nome }),
      });
      const dados = (await resposta.json()) as { ok: boolean; error?: string };
      if (!dados.ok) throw new Error(dados.error ?? "falhou");

      onFechar();
      router.refresh();
    } catch {
      setErro("Não consegui salvar, tenta de novo.");
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h2 className="mb-1 text-base font-semibold text-neutral-900">Editar nome da instância</h2>
        <p className="mb-3 text-xs text-neutral-500">
          É só um apelido pra você reconhecer aqui no CRM — não muda o perfil real do WhatsApp.
        </p>

        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={60}
          autoFocus
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
        {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando || !nome.trim()}
            onClick={salvar}
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function IconeLapis() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconeDesconectar() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4.9 4.9 19.1 19.1" />
      <path d="M8.5 8.5a6 6 0 0 0 7 9.6M15.5 5.9A6 6 0 0 1 18 12" />
    </svg>
  );
}

function IconeAtualizar({ girando }: { girando: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={girando ? "animate-spin" : ""}
    >
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6" />
    </svg>
  );
}
