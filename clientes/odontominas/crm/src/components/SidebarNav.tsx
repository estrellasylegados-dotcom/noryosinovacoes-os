"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Papel } from "@/lib/sessao";

type Item = { href: string; label: string; adminOnly?: boolean; group?: string };

const ITENS: Item[] = [
  { href: "/", label: "Painel de Atendimento" },
  { href: "/chat", label: "Chat ao Vivo" },
  { href: "/resumo", label: "Relatórios", adminOnly: true },
  { href: "/conexao", label: "Conexão WhatsApp", adminOnly: true },
  { href: "/agentes", label: "Agentes de IA", adminOnly: true, group: "Ferramentas" },
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

export function SidebarNav({ papel, naoLidas = 0 }: { papel: Papel; naoLidas?: number }) {
  const pathname = usePathname();
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
      {Array.from(grupos.entries()).map(([nome, itens]) => (
        <div key={nome} className="flex gap-1 sm:mt-2 sm:flex-col">
          <p className="hidden px-3 pt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 sm:block">{nome}</p>
          {itens.map((item) => (
            <ItemLink key={item.href} item={item} ativo={ehAtivo(item)} naoLidas={naoLidas} />
          ))}
        </div>
      ))}
    </nav>
  );
}
