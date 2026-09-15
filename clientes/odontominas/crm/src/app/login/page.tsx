"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function FormularioLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (!resposta.ok) {
        setErro("Senha incorreta.");
        setEnviando(false);
        return;
      }
      const destino = searchParams.get("redirect") || "/";
      router.push(destino);
      router.refresh();
    } catch {
      setErro("Não deu pra entrar. Tenta de novo.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">CRM OdontoMinas</h1>
        <p className="text-sm text-neutral-500">Entre com a senha da clínica.</p>
      </div>
      <input
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Senha"
        autoFocus
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
      />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button
        type="submit"
        disabled={enviando || !senha}
        className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
      >
        {enviando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-8">
      <Suspense>
        <FormularioLogin />
      </Suspense>
    </main>
  );
}
