"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Papel } from "@/lib/sessao";

type Item = { href: string; label: string; adminOnly?: boolean; group?: string };

const ITENS: Item[] = [
  { href: "/", label: "Painel de Atendimento" },
  { href: "/chat", label: "Chat ao Vivo" },
  { href: "/resumo", label: "Relatórios", adminOnly: true },
  { href: "/conexao", label: "Conexão WhatsApp", adminOnly: true },
  { href: "/agentes", label: "Agentes de IA", adminOnly: true, group: "Ferramentas" },
  { href: "/disparos", label: "Disparos", adminOnly: true, group: "Ferramentas" },
  { href: "/integracoes/controle-odonto", label: "ControleODONTO", adminOnly: true, group: "Ferramentas" },
];

function ItemLink({ item, ativo, naoLidas }: { item: Item; ativo: boolean; naoLidas: number }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        ativo ? "bg-teal-700 text-white" : "text-neutral-600 hover:bg-neutral-100"
      }`}
    >
      <span>{item.label}</span>
      {item.href === "/chat" && naoLidas > 0 && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
            ativo ? "bg-white/20 text-white" : "bg-red-500 text-white"
          }`}
        >
          {naoLidas > 99 ? "99+" : naoLidas}
        </span>
      )}
    </Link>
  );
}

function IconeRaio() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
    </svg>
  );
}

function IconeChevron({ aberto }: { aberto: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform duration-150 ${aberto ? "" : "rotate-180"}`}
    >
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}

export function SidebarNav({ papel, naoLidas = 0 }: { papel: Papel; naoLidas?: number }) {
  const pathname = usePathname();
  const [gruposFechados, setGruposFechados] = useState<Record<string, boolean>>({});
  const visiveis = ITENS.filter((item) => !item.adminOnly || papel === "admin");
  const soltos = visiveis.filter((item) => !item.group);
  const grupos = new Map<string, Item[]>();
  for (const item of visiveis) {
    if (!item.group) continue;
    if (!grupos.has(item.group)) grupos.set(item.group, []);
    grupos.get(item.group)!.push(item);
  }

  function ehAtivo(item: Item) {
    return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  }

  return (
    <nav className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
      {soltos.map((item) => (
        <ItemLink key={item.href} item={item} ativo={ehAtivo(item)} naoLidas={naoLidas} />
      ))}
      {Array.from(grupos.entries()).map(([nome, itens]) => {
        const aberto = !gruposFechados[nome];
        return (
          <div key={nome} className="flex flex-wrap gap-1 sm:mt-2 sm:flex-col">
            <button
              type="button"
              onClick={() => setGruposFechados((prev) => ({ ...prev, [nome]: aberto }))}
              aria-expanded={aberto}
              className="hidden w-full items-center justify-between gap-2 rounded-lg px-3 pt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 hover:text-neutral-600 sm:flex"
            >
              <span className="flex items-center gap-1.5">
                <IconeRaio />
                {nome}
              </span>
              <IconeChevron aberto={aberto} />
            </button>
            <div className={`contents ${aberto ? "" : "sm:hidden"}`}>
              {itens.map((item) => (
                <ItemLink key={item.href} item={item} ativo={ehAtivo(item)} naoLidas={naoLidas} />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
