import Link from "next/link";
import type { ReactNode } from "react";
import type { NivelSaude } from "@/lib/noryos-ops";

export const OPS_ABAS = [
  ["/ops", "Visão Geral"],
  ["/ops/clinicas", "Clínicas"],
  ["/ops/canais", "Canais"],
  ["/ops/integracoes", "Integrações"],
  ["/ops/workers", "Workers"],
  ["/ops/erros", "Erros"],
  ["/ops/incidentes", "Incidentes"],
  ["/ops/deploys", "Deploys"],
  ["/ops/auditoria", "Auditoria"],
] as const;

export function OpsShell({ ativo, children }: { ativo: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Plataforma</p>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">Noryos Ops</h1>
        </div>
        <nav className="flex gap-2 overflow-x-auto border-b border-neutral-200 pb-2">
          {OPS_ABAS.map(([href, label]) => (
            <Link key={href} href={href} className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${ativo === href ? "bg-teal-700 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>
              {label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </main>
  );
}

export function OpsForbidden() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold text-neutral-950">Acesso restrito</h1>
      <p className="mt-2 text-sm text-neutral-600">Noryos Ops é uma área técnica da plataforma. Este perfil não tem permissão para acessar.</p>
    </main>
  );
}

export function SaudeBadge({ nivel }: { nivel: NivelSaude | "nao_configurada" }) {
  const cls =
    nivel === "saudavel"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : nivel === "critico"
        ? "bg-red-50 text-red-700 ring-red-200"
        : nivel === "nao_configurada"
          ? "bg-neutral-100 text-neutral-600 ring-neutral-200"
          : "bg-amber-50 text-amber-700 ring-amber-200";
  const label = nivel === "saudavel" ? "Saudável" : nivel === "critico" ? "Crítico" : nivel === "nao_configurada" ? "Não configurada" : "Atenção";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${cls}`}>{label}</span>;
}

export function MetricCard({ label, value, nivel }: { label: string; value: string | number; nivel?: NivelSaude }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-neutral-500">{label}</p>
        {nivel && <SaudeBadge nivel={nivel} />}
      </div>
      <p className="mt-3 text-2xl font-semibold text-neutral-950">{value}</p>
    </div>
  );
}

export function OpsTable({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">{children}</div>;
}

export function fmtData(v: string | null | undefined) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(v));
}
