"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Papel } from "@/lib/sessao";

type Item = { href: string; label: string; adminOnly?: boolean };

const ITENS: Item[] = [
  { href: "/", label: "Painel de Atendimento" },
  { href: "/chat", label: "Chat ao Vivo" },
  { href: "/resumo", label: "Relatórios", adminOnly: true },
  { href: "/conexao", label: "Conexão WhatsApp", adminOnly: true },
];

export function SidebarNav({ papel, naoLidas = 0 }: { papel: Papel; naoLidas?: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
      {ITENS.filter((item) => !item.adminOnly || papel === "admin").map((item) => {
        const ativo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
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
      })}
    </nav>
  );
}
