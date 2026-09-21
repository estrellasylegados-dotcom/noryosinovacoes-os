"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Perfil } from "@/lib/permissoes";

const PERFIL_LABEL: Record<Perfil, string> = {
  noryos_admin: "Administração Noryos",
  noryos_suporte: "Suporte Noryos",
  dona: "Responsável pela clínica",
  gerente: "Gerência",
  supervisora: "Supervisão",
  atendente: "Atendimento",
};

function iniciais(nome: string) {
  return nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase();
}

function Chevron() {
  return <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>;
}

function IconeSenha() {
  return <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
}

function IconeSair() {
  return <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 3v18" /></svg>;
}

type Props = {
  nome: string;
  usuario: string;
  email: string | null;
  perfil: Perfil;
  variante?: "topo" | "sidebar";
};

/** Menu único para header e sidebar; autorização permanece no servidor. */
export function PerfilMenu({ nome, usuario, email, perfil, variante = "topo" }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sidebar = variante === "sidebar";

  useEffect(() => {
    function fecharAoClicarFora(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fecharAoClicarFora);
    return () => document.removeEventListener("mousedown", fecharAoClicarFora);
  }, []);

  async function sair() {
    setSaindo(true);
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={ref} className={`relative ${sidebar ? "w-full" : "shrink-0"}`}>
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        className={`flex w-full items-center gap-2 rounded-xl text-left transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500/40 ${sidebar ? "border border-neutral-200 bg-white px-2.5 py-2 hover:border-teal-200 hover:bg-teal-50/60" : "px-2 py-1.5 hover:bg-neutral-100"}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">{iniciais(nome)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-neutral-800">{nome}</span>
          {sidebar && <span className="block truncate text-xs text-neutral-500">Conta ativa</span>}
        </span>
        <span className={`shrink-0 text-neutral-400 transition-transform ${aberto ? "rotate-180" : ""}`}><Chevron /></span>
      </button>

      {aberto && (
        <div role="menu" className={`absolute z-50 min-w-72 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl shadow-teal-950/10 ${sidebar ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2"}`}>
          <div className="flex items-center gap-3 rounded-lg bg-neutral-50 px-3 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-800">{iniciais(nome)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-neutral-900">{nome}</span>
              <span className="block truncate text-xs text-neutral-500">{PERFIL_LABEL[perfil]}</span>
              <span className="mt-0.5 block truncate text-xs text-neutral-400">{email ?? usuario}</span>
            </span>
          </div>
          <div className="my-1 border-t border-neutral-100" />
          <Link href="/esqueci-senha" role="menuitem" onClick={() => setAberto(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-teal-50 hover:text-teal-800"><IconeSenha /> Trocar senha</Link>
          <button type="button" role="menuitem" onClick={sair} disabled={saindo} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"><IconeSair /> {saindo ? "Saindo..." : "Sair"}</button>
        </div>
      )}
    </div>
  );
}
