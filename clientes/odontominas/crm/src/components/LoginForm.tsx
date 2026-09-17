"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function FormularioLogin({ clinicaNome }: { clinicaNome: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usuario, setUsuario] = useState("");
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
        body: JSON.stringify({ usuario, senha }),
      });
      if (!resposta.ok) {
        setErro("Usuário ou senha incorretos.");
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
        <h1 className="text-lg font-semibold text-neutral-900">CRM {clinicaNome}</h1>
        <p className="text-sm text-neutral-500">Entre com sua conta.</p>
      </div>
      <input
        type="text"
        value={usuario}
        onChange={(e) => setUsuario(e.target.value)}
        placeholder="Usuário"
        autoFocus
        autoCapitalize="off"
        autoCorrect="off"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
      />
      <input
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Senha"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
      />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button
        type="submit"
        disabled={enviando || !usuario || !senha}
        className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
      >
        {enviando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

/** Fase 3, branding dinâmico — `clinicaNome` vem do Server Component pai (app/login/page.tsx), que é quem pode ler o banco. */
export function LoginForm({ clinicaNome }: { clinicaNome: string }) {
  return (
    <Suspense>
      <FormularioLogin clinicaNome={clinicaNome} />
    </Suspense>
  );
}
