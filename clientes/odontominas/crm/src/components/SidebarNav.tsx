"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import type { Permissao } from "@/lib/permissoes";

type Icone = "painel" | "chat" | "alertas" | "canais" | "kanban" | "indicadores" | "campanhas" | "agentes" | "disparos" | "fluxos" | "reputacao" | "ops" | "configuracoes" | "equipe" | "integracoes";
type Item = { href: string; label: string; icone: Icone; permissao?: Permissao; group: string };

const ITENS: Item[] = [
  { group: "Atendimento", href: "/", label: "Painel de Atendimento", icone: "painel" },
  { group: "Atendimento", href: "/chat", label: "Chat ao Vivo", icone: "chat" },
  { group: "Atendimento", href: "/alertas", label: "Alertas", icone: "alertas", permissao: "alertas.visualizar" },
  { group: "Atendimento", href: "/configuracoes/canais", label: "Canais", icone: "canais", permissao: "canais.visualizar" },
  { group: "Comercial", href: "/kanban", label: "CRM / Kanban", icone: "kanban", permissao: "kanban.visualizar" },
  { group: "Comercial", href: "/resumo", label: "Indicadores", icone: "indicadores", permissao: "relatorios.visualizar" },
  { group: "Marketing e automações", href: "/campanhas", label: "Campanhas", icone: "campanhas", permissao: "automacoes.visualizar" },
  { group: "Marketing e automações", href: "/agentes", label: "Agentes de IA", icone: "agentes", permissao: "automacoes.visualizar" },
  { group: "Marketing e automações", href: "/disparos", label: "Disparos", icone: "disparos", permissao: "automacoes.visualizar" },
  { group: "Marketing e automações", href: "/fluxos", label: "Fluxo de Conversa", icone: "fluxos", permissao: "automacoes.visualizar" },
  { group: "Marketing e automações", href: "/reputacao", label: "Reputação", icone: "reputacao", permissao: "configuracoes.reputacao" },
  { group: "Administração", href: "/ops", label: "Noryos Ops", icone: "ops", permissao: "ops.visualizar" },
  { group: "Administração", href: "/equipe", label: "Equipe", icone: "equipe", permissao: "usuarios.visualizar" },
  { group: "Administração", href: "/configuracoes/horario", label: "Configurações", icone: "configuracoes", permissao: "configuracoes.horario" },
  { group: "Administração", href: "/configuracoes/distribuicao", label: "Distribuição automática", icone: "configuracoes", permissao: "configuracoes.clinica" },
  { group: "Administração", href: "/configuracoes/sla", label: "SLA e atendimento", icone: "configuracoes", permissao: "sla.visualizar" },
  { group: "Administração", href: "/configuracoes/alertas", label: "Regras de alertas", icone: "configuracoes", permissao: "alertas.configurar" },
  { group: "Administração", href: "/integracoes/controle-odonto", label: "Integrações", icone: "integracoes", permissao: "configuracoes.integracoes" },
];

function IconeMenu({ nome }: { nome: Icone }) {
  const comum = { width: 17, height: 17, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24", "aria-hidden": true };
  const paths: Record<Icone, ReactNode> = {
    painel: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    chat: <><path d="M20 15a4 4 0 0 1-4 4H8l-4 3v-7a4 4 0 0 1-2-3.5V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M7 9h.01M12 9h.01M17 9h.01" /></>,
    alertas: <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    canais: <><path d="M7 17.5 4.5 20l1-3.5A7 7 0 1 1 7 17.5Z" /><path d="M8 10h8M8 13h5" /></>,
    kanban: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01" /></>,
    indicadores: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
    campanhas: <><path d="m4 14 5-5 7 7-5 5-7-7Z" /><path d="m14 6 1-1a3 3 0 0 1 4 4l-1 1M7 17l-2 2M17 7l2-2" /></>,
    agentes: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0M18 8h3M19.5 6.5v3" /></>,
    disparos: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    fluxos: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 6h7M6 8.5V18h9.5" /></>,
    reputacao: <path d="m12 3 2.8 5.7L21 9.6l-4.5 4.3 1.1 6.1-5.6-3-5.6 3 1.1-6.1L3 9.6l6.2-.9Z" />,
    ops: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="4" /></>,
    configuracoes: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.5 2.5-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3.5v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.5-2.5.1-.1A1.7 1.7 0 0 0 5.6 15a1.7 1.7 0 0 0-1.5-1H4v-3.5h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7.8 5l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3.7h3.5v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.5 2.5-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.4 1Z" /></>,
    equipe: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M17 11a3 3 0 1 0-1.5-5.6M18 20a5 5 0 0 0-2-4" /></>,
    integracoes: <><path d="m8 12 3-3a3 3 0 0 1 4.2 4.2l-3 3" /><path d="m16 12-3 3A3 3 0 0 1 8.8 10.8l3-3" /></>,
  };
  return <svg {...comum}>{paths[nome]}</svg>;
}

function Chevron({ aberto }: { aberto: boolean }) {
  return <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${aberto ? "" : "-rotate-90"}`} aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>;
}

function ItemLink({ item, ativo, naoLidas, alertas }: { item: Item; ativo: boolean; naoLidas: number; alertas: number }) {
  const contagem = item.href === "/chat" ? naoLidas : item.href === "/alertas" ? alertas : 0;
  return <Link href={item.href} className={`group flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-sm font-medium transition-all ${ativo ? "bg-teal-700 text-white shadow-sm shadow-teal-900/10" : "text-neutral-600 hover:bg-teal-50 hover:text-teal-800"}`}>
    <span className="flex min-w-0 items-center gap-2.5"><span className={ativo ? "text-white" : "text-neutral-400 group-hover:text-teal-700"}><IconeMenu nome={item.icone} /></span><span className="truncate">{item.label}</span></span>
    {contagem > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${ativo ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}>{contagem > 99 ? "99+" : contagem}</span>}
  </Link>;
}

/** Visibilidade continua baseada na mesma lista de permissões resolvida no servidor; esconder links é UX, não autorização. */
export function SidebarNav({ permissoes, naoLidas = 0, alertas = 0 }: { permissoes: readonly Permissao[]; naoLidas?: number; alertas?: number }) {
  const pathname = usePathname();
  const [gruposFechados, setGruposFechados] = useState<Record<string, boolean>>({});
  const visiveis = ITENS.filter((item) => !item.permissao || permissoes.includes(item.permissao));
  const grupos = Array.from(new Set(ITENS.map((item) => item.group))).map((nome) => [nome, visiveis.filter((item) => item.group === nome)] as const).filter(([, itens]) => itens.length > 0);
  const ehAtivo = (item: Item) => item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

  return <nav aria-label="Navegação principal" className="flex gap-1 overflow-x-auto sm:flex-col sm:gap-3 sm:overflow-visible">
    {grupos.map(([nome, itens]) => {
      const aberto = !gruposFechados[nome];
      return <section key={nome} className="min-w-max sm:min-w-0">
        <button type="button" onClick={() => setGruposFechados((prev) => ({ ...prev, [nome]: aberto }))} aria-expanded={aberto} className="hidden w-full items-center justify-between px-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400 hover:text-teal-700 sm:flex"><span>{nome}</span><Chevron aberto={aberto} /></button>
        <div className={`flex gap-1 sm:flex-col ${aberto ? "" : "sm:hidden"}`}>{itens.map((item) => <ItemLink key={item.href} item={item} ativo={ehAtivo(item)} naoLidas={naoLidas} alertas={alertas} />)}</div>
      </section>;
    })}
  </nav>;
}
