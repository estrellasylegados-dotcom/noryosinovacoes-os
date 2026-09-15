"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Papel } from "@/lib/sessao";

type Item = { href: string; label: string; adminOnly?: boolean };

const ITENS: Item[] = [
  { href: "/", label: "Painel de Atendimento" },
  { href: "/equipe", label: "Equipe", adminOnly: true },
  { href: "/resumo", label: "Resumo Executivo", adminOnly: true },
  { href: "/conexao", label: "Conexão WhatsApp", adminOnly: true },
];

export function SidebarNav({ papel }: { papel: Papel }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
      {ITENS.filter((item) => !item.adminOnly || papel === "admin").map((item) => {
        const ativo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              ativo ? "bg-teal-700 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
