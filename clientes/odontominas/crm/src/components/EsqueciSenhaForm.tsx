"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

/** Resposta sempre genérica (seção 27 do pedido) — o formulário nunca sabe se o e-mail existe. */
export function EsqueciSenhaForm() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setEnviando(false);
      setEnviado(true);
    }
  }

  if (enviado) {
    return (
      <div className="w-full max-w-xs space-y-3 text-center">
        <p className="text-sm text-neutral-700">Se existir uma conta associada a este e-mail, enviaremos instruções.</p>
        <Link href="/login" className="text-sm text-teal-700 hover:underline">
          Voltar pro login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Esqueci minha senha</h1>
        <p className="text-sm text-neutral-500">Informe o e-mail cadastrado.</p>
      </div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-mail"
        autoFocus
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
      />
      <button
        type="submit"
        disabled={enviando || !email}
        className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
      >
        {enviando ? "Enviando..." : "Enviar instruções"}
      </button>
      <p className="text-center text-xs text-neutral-400">
        <Link href="/login" className="hover:text-teal-700 hover:underline">
          Voltar pro login
        </Link>
      </p>
    </form>
  );
}
