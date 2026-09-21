import type { ReactNode } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { buscarStatusConexao } from "@/lib/evolution-status";
import { buscarClinicaAtual, getClinicaId } from "@/lib/clinica";
import { obterBranding } from "@/lib/branding";
import { buscarCanalPrincipal } from "@/lib/canais";
import { contarNaoLidas } from "@/lib/chat";
import { buscarNotificacoes } from "@/lib/notificacoes";
import { resumirAlertas } from "@/lib/alertas-consulta";
import { atorAlerta, clinicaDaSessao } from "@/lib/alertas-http";
import { can } from "@/lib/autorizacao";
import { formatTelefone } from "@/lib/tempo";
import { AutoRefresh } from "@/components/AutoRefresh";
import { SidebarNav } from "@/components/SidebarNav";
import { SidebarShell } from "@/components/SidebarShell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Notificacoes } from "@/components/Notificacoes";
import { AlertasSino } from "@/components/alertas/AlertasSino";
import { PerfilMenu } from "@/components/PerfilMenu";

/** Casca visual autenticada: identidade, navegação por RBAC e dados operacionais compartilhados. */
export default async function PainelLayout({ children }: { children: ReactNode }) {
  const sessao = await getSessaoAtual();
  if (!sessao) redirect("/login");

  const clinicaId = await getClinicaId();
  const canalPrincipal = clinicaId ? await buscarCanalPrincipal(clinicaId) : null;
  const clinicaDosAlertas = clinicaDaSessao(sessao, clinicaId);
  const [statusConexao, naoLidas, notificacoes, clinicaAtual, resumoAlertas] = await Promise.all([
    buscarStatusConexao(canalPrincipal?.providerInstanceId),
    clinicaId ? contarNaoLidas(clinicaId) : Promise.resolve(0),
    clinicaId ? buscarNotificacoes(clinicaId) : Promise.resolve([]),
    buscarClinicaAtual(),
    clinicaDosAlertas && can(sessao, "alertas.visualizar") ? resumirAlertas(clinicaDosAlertas, atorAlerta(sessao)) : Promise.resolve(null),
  ]);
  const apelidoInstancia = canalPrincipal?.nome ?? null;
  const branding = obterBranding(clinicaAtual);
  const corConexao = statusConexao.conectado ? "bg-emerald-500" : statusConexao.conectado === false ? "bg-red-500" : "bg-neutral-300";
  const textoConexao = statusConexao.conectado
    ? apelidoInstancia || statusConexao.nome || "WhatsApp conectado"
    : statusConexao.conectado === false ? "WhatsApp desconectado" : "WhatsApp — sem status";
  const iniciais = sessao.nome.split(/\s+/).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-neutral-50 sm:flex">
      <AutoRefresh />
      <SidebarShell
        titulo={<div className="sm:mb-1"><Image src={branding.logoSrc} alt={clinicaAtual?.nome ?? "Clínica"} width={150} height={56} priority unoptimized className="mx-auto h-auto max-h-12 w-auto max-w-[150px] object-contain" /><p className="mt-1 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">CRM · Atendimento</p></div>}
        nav={<SidebarNav permissoes={Array.from(sessao.permissoes)} naoLidas={naoLidas} alertas={resumoAlertas?.relevantes ?? 0} />}
        rodape={
          <div className="space-y-3">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white ${corConexao}`} />
                <div className="min-w-0"><p className="truncate text-xs font-semibold text-neutral-700">WhatsApp principal</p><p className="truncate text-[11px] text-neutral-500">{textoConexao}</p>{statusConexao.numero && <p className="truncate text-[11px] text-neutral-400">{formatTelefone(statusConexao.numero)}</p>}</div>
              </div>
            </div>
            <PerfilMenu nome={sessao.nome} usuario={sessao.usuario} email={sessao.email} perfil={sessao.perfil} variante="sidebar" />
          </div>
        }
        rodapeCompacto={<div className="flex flex-col items-center gap-3 border-t border-neutral-100 pt-4"><span className={`h-2 w-2 rounded-full ${corConexao}`} title={textoConexao} /><span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-800" title={sessao.nome}>{iniciais}</span></div>}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-end gap-1 border-b border-neutral-200/80 bg-white/95 px-4 backdrop-blur sm:px-6">
          <ThemeToggle />
          {resumoAlertas && <AlertasSino inicial={resumoAlertas} />}
          <Notificacoes inicial={notificacoes} />
          <PerfilMenu nome={sessao.nome} usuario={sessao.usuario} email={sessao.email} perfil={sessao.perfil} />
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
