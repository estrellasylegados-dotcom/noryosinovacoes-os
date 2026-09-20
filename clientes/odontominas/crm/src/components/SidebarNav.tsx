"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Permissao } from "@/lib/permissoes";

type Item = { href: string; label: string; permissao?: Permissao; group?: string };

const ITENS: Item[] = [
  { href: "/", label: "Painel de Atendimento" },
  { href: "/chat", label: "Chat ao Vivo" },
  { href: "/alertas", label: "Alertas", permissao: "alertas.visualizar" },
  { href: "/ops", label: "Noryos Ops", permissao: "ops.visualizar" },
  { href: "/kanban", label: "CRM · Kanban", permissao: "kanban.visualizar" },
  { href: "/resumo", label: "Relatórios", permissao: "relatorios.visualizar" },
  { href: "/configuracoes/canais", label: "Canais", permissao: "canais.visualizar" },
  { href: "/campanhas", label: "Campanhas", permissao: "automacoes.visualizar", group: "Ferramentas" },
  { href: "/agentes", label: "Agentes de IA", permissao: "automacoes.visualizar", group: "Ferramentas" },
  { href: "/disparos", label: "Disparos", permissao: "automacoes.visualizar", group: "Ferramentas" },
  { href: "/fluxos", label: "Fluxo de Conversa", permissao: "automacoes.visualizar", group: "Ferramentas" },
  { href: "/reputacao", label: "Reputação", permissao: "configuracoes.reputacao", group: "Ferramentas" },
  { href: "/integracoes/controle-odonto", label: "ControleODONTO", permissao: "configuracoes.integracoes", group: "Ferramentas" },
  { href: "/equipe", label: "Equipe", permissao: "usuarios.visualizar", group: "Configurações" },
  { href: "/configuracoes/horario", label: "Horário de Atendimento", permissao: "configuracoes.horario", group: "Configurações" },
  { href: "/configuracoes/sla", label: "SLA / Atendimento", permissao: "sla.visualizar", group: "Configurações" },
  { href: "/configuracoes/alertas", label: "Alertas (regras)", permissao: "alertas.configurar", group: "Configurações" },
];

ITENS.splice(ITENS.findIndex((item) => item.href === "/configuracoes/sla"), 0, {
  href: "/configuracoes/distribuicao",
  label: "Distribuição automática",
  permissao: "configuracoes.clinica",
  group: "Configurações",
});

function ItemLink({ item, ativo, naoLidas, alertas }: { item: Item; ativo: boolean; naoLidas: number; alertas: number }) {
  const contagem = item.href === "/chat" ? naoLidas : item.href === "/alertas" ? alertas : 0;
  return (
    <Link
      href={item.href}
      className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        ativo ? "bg-teal-700 text-white" : "text-neutral-600 hover:bg-neutral-100"
      }`}
    >
      <span>{item.label}</span>
      {contagem > 0 && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
            ativo ? "bg-white/20 text-white" : "bg-red-500 text-white"
          }`}
        >
          {contagem > 99 ? "99+" : contagem}
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

/** `permissoes` vem de `sessao.permissoes` (Server Component, já resolvida — ver src/lib/sessao-servidor.ts). Esconder item aqui é só UX: a rota por trás sempre reconfere com requirePermission (backend é autoridade, seção 14 do pedido). */
export function SidebarNav({ permissoes, naoLidas = 0, alertas = 0 }: { permissoes: readonly Permissao[]; naoLidas?: number; alertas?: number }) {
  const pathname = usePathname();
  const [gruposFechados, setGruposFechados] = useState<Record<string, boolean>>({});
  const temPermissao = (p?: Permissao) => !p || permissoes.includes(p);
  const visiveis = ITENS.filter((item) => temPermissao(item.permissao));
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
        <ItemLink key={item.href} item={item} ativo={ehAtivo(item)} naoLidas={naoLidas} alertas={alertas} />
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
                <ItemLink key={item.href} item={item} ativo={ehAtivo(item)} naoLidas={naoLidas} alertas={alertas} />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
