"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

function FormularioLogin({ clinicaNome, logoSrc }: { clinicaNome: string; logoSrc: string }) {
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
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl shadow-teal-950/[0.06] sm:p-8">
      <div className="space-y-3">
        <Image src={logoSrc} alt={clinicaNome} width={168} height={64} priority unoptimized className="h-auto max-h-14 w-auto max-w-[168px] object-contain object-left" />
        <div><h1 className="text-lg font-semibold text-neutral-900">Acesse o CRM</h1><p className="text-sm text-neutral-500">Entre com sua conta para continuar.</p></div>
      </div>
      <input
        type="text"
        value={usuario}
        onChange={(e) => setUsuario(e.target.value)}
        placeholder="Usuário"
        autoFocus
        autoCapitalize="off"
        autoCorrect="off"
        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
      />
      <input
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Senha"
        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
      />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button
        type="submit"
        disabled={enviando || !usuario || !senha}
        className="w-full rounded-xl bg-teal-700 px-3 py-2.5 text-sm font-semibold text-white shadow-sm shadow-teal-900/20 transition-colors hover:bg-teal-800 disabled:opacity-50"
      >
        {enviando ? "Entrando..." : "Entrar"}
      </button>
      <p className="text-center text-xs text-neutral-400">
        <Link href="/esqueci-senha" className="hover:text-teal-700 hover:underline">
          Esqueci minha senha
        </Link>
      </p>
    </form>
  );
}

/** Fase 3, branding dinâmico — `clinicaNome` vem do Server Component pai (app/login/page.tsx), que é quem pode ler o banco. */
export function LoginForm({ clinicaNome, logoSrc = "/logo-crm.png" }: { clinicaNome: string; logoSrc?: string }) {
  return (
    <Suspense>
      <FormularioLogin clinicaNome={clinicaNome} logoSrc={logoSrc} />
    </Suspense>
  );
}
