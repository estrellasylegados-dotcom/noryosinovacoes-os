"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Notificacao } from "@/lib/notificacoes";
import {
  deveNotificar,
  lerPreferenciaNotificacao,
  PREFERENCIA_LABEL,
  PREFERENCIAS_ORDEM,
  salvarPreferenciaNotificacao,
  type PreferenciaNotificacao,
} from "@/lib/notificacoes-preferencia";

const INTERVALO_MS = 20000;

// Layout do slider de 3 posições — trilho de 96px, thumb de 20px, 2px de folga em cada ponta.
const TRILHO_PX = 96;
const THUMB_PX = 20;
const PADDING_PX = 2;
const PASSO_PX = (TRILHO_PX - THUMB_PX - PADDING_PX * 2) / (PREFERENCIAS_ORDEM.length - 1);

function indicePelaPosicaoX(clientX: number, trilho: HTMLElement): number {
  const rect = trilho.getBoundingClientRect();
  const fracao = (clientX - rect.left) / rect.width;
  const bruto = Math.round(fracao * (PREFERENCIAS_ORDEM.length - 1));
  return Math.min(PREFERENCIAS_ORDEM.length - 1, Math.max(0, bruto));
}

function SliderPreferencia({
  valor,
  onChange,
}: {
  valor: PreferenciaNotificacao;
  onChange: (v: PreferenciaNotificacao) => void;
}) {
  const trilhoRef = useRef<HTMLDivElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const indiceAtual = PREFERENCIAS_ORDEM.indexOf(valor);
  const [indiceVisual, setIndiceVisual] = useState(indiceAtual);

  useEffect(() => {
    if (!arrastando) setIndiceVisual(indiceAtual);
  }, [indiceAtual, arrastando]);

  useEffect(() => {
    if (!arrastando) return;

    function mover(e: PointerEvent) {
      if (trilhoRef.current) setIndiceVisual(indicePelaPosicaoX(e.clientX, trilhoRef.current));
    }
    function soltar(e: PointerEvent) {
      setArrastando(false);
      if (trilhoRef.current) onChange(PREFERENCIAS_ORDEM[indicePelaPosicaoX(e.clientX, trilhoRef.current)]);
    }

    document.addEventListener("pointermove", mover);
    document.addEventListener("pointerup", soltar);
    return () => {
      document.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerup", soltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastando]);

  function iniciarArraste(e: ReactPointerEvent) {
    e.preventDefault();
    setArrastando(true);
  }

  return (
    <div className="flex items-center gap-2">
      <div
        ref={trilhoRef}
        onPointerDown={iniciarArraste}
        className="relative h-6 shrink-0 cursor-pointer touch-none rounded-full bg-neutral-200"
        style={{ width: TRILHO_PX }}
        role="slider"
        aria-label="Preferência de notificações do navegador"
        aria-valuemin={0}
        aria-valuemax={PREFERENCIAS_ORDEM.length - 1}
        aria-valuenow={indiceVisual}
        aria-valuetext={PREFERENCIA_LABEL[PREFERENCIAS_ORDEM[indiceVisual]]}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${arrastando ? "" : "transition-[left] duration-150"}`}
          style={{ left: PADDING_PX + indiceVisual * PASSO_PX }}
        />
      </div>
      <span className="w-20 shrink-0 text-[11px] text-neutral-500">{PREFERENCIA_LABEL[PREFERENCIAS_ORDEM[indiceVisual]]}</span>
    </div>
  );
}

/** Notificação real do navegador — nunca lança: sem suporte ou sem permissão, simplesmente não mostra nada. */
function notificarNavegador(n: Notificacao) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const notif = new Notification(n.titulo, { body: n.subtitulo, tag: n.id });
    notif.onclick = () => {
      window.focus();
      window.location.href = n.href;
    };
  } catch {
    // ambiente sem suporte real a Notification apesar de "in window" (ex.: alguns webviews) — silencioso.
  }
}

export function Notificacoes({ inicial }: { inicial: Notificacao[] }) {
  const [notificacoes, setNotificacoes] = useState(inicial);
  const [aberto, setAberto] = useState(false);
  const [permissao, setPermissao] = useState<NotificationPermission | "unsupported">("unsupported");
  const [pref, setPref] = useState<PreferenciaNotificacao>("tudo");
  const containerRef = useRef<HTMLDivElement>(null);
  const prefRef = useRef(pref);
  const vistasRef = useRef<Set<string>>(new Set(inicial.map((n) => n.id)));

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setPermissao(Notification.permission);
    setPref(lerPreferenciaNotificacao());
  }, []);

  useEffect(() => {
    prefRef.current = pref;
  }, [pref]);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/notificacoes");
        const dados = (await res.json()) as { ok: boolean; notificacoes?: Notificacao[] };
        if (!dados.ok || !dados.notificacoes) return;

        for (const n of dados.notificacoes) {
          if (!vistasRef.current.has(n.id) && deveNotificar(n.tipo, prefRef.current)) {
            notificarNavegador(n);
          }
        }
        vistasRef.current = new Set(dados.notificacoes.map((n) => n.id));
        setNotificacoes(dados.notificacoes);
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

  function pedirPermissao() {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "default") return;
    Notification.requestPermission().then(setPermissao);
  }

  function mudarPreferencia(novaPref: PreferenciaNotificacao) {
    setPref(novaPref);
    salvarPreferenciaNotificacao(novaPref);
    if (novaPref !== "desligado") pedirPermissao();
  }

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
        {permissao === "default" && (
          <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-teal-500" title="Ative as notificações" />
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-11 z-20 w-80 rounded-xl border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">Notificações</p>
          </div>

          {permissao !== "unsupported" && (
            <div className="border-b border-neutral-100 px-4 py-3">
              {permissao === "default" && (
                <button
                  type="button"
                  onClick={pedirPermissao}
                  className="mb-2 flex items-start gap-2 text-left text-xs font-medium text-teal-700 hover:text-teal-800"
                >
                  <span aria-hidden>🔔</span>
                  Ative as notificações para não perder mensagens
                </button>
              )}
              {permissao === "denied" && (
                <p className="mb-2 text-xs text-neutral-500">
                  Notificações bloqueadas pelo navegador — pra não perder mensagem, ative nas configurações do site.
                </p>
              )}
              {permissao === "granted" && (
                <p className="mb-2 text-xs text-neutral-500">Notificações do navegador ativadas.</p>
              )}
              <SliderPreferencia valor={pref} onChange={mudarPreferencia} />
            </div>
          )}

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
