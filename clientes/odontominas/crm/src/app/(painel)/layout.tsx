import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { buscarStatusConexao } from "@/lib/evolution-status";
import { buscarClinicaAtual, getClinicaId } from "@/lib/clinica";
import { buscarCanalPrincipal } from "@/lib/canais";
import { contarNaoLidas } from "@/lib/chat";
import { buscarNotificacoes } from "@/lib/notificacoes";
import { resumirAlertas } from "@/lib/alertas-consulta";
import { atorAlerta, clinicaDaSessao } from "@/lib/alertas-http";
import { can } from "@/lib/autorizacao";
import { formatTelefone } from "@/lib/tempo";
import { AutoRefresh } from "@/components/AutoRefresh";
import { LogoutButton } from "@/components/LogoutButton";
import { SidebarNav } from "@/components/SidebarNav";
import { SidebarShell } from "@/components/SidebarShell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Notificacoes } from "@/components/Notificacoes";
import { AlertasSino } from "@/components/alertas/AlertasSino";

/**
 * Casca visual de todo o painel logado: menu lateral (nav + status de
 * conexão do WhatsApp + identidade de quem entrou) + barra superior (tema,
 * notificações, nome de quem está logado — nessa ordem, a pedido do Rafael,
 * inspirado na RoiZap). Aplicada via route group a todas as páginas
 * protegidas (o middleware já barra sem sessão — este redirect aqui é
 * defesa em profundidade, um Server Component não confia cegamente no
 * header de quem chamou).
 */
export default async function PainelLayout({ children }: { children: ReactNode }) {
  const sessao = await getSessaoAtual();

  if (!sessao) redirect("/login");

  const clinicaId = await getClinicaId();
  // A bolinha do menu lateral mostra o canal PRINCIPAL da clínica (status ao vivo).
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
  const corConexao = statusConexao.conectado ? "bg-emerald-500" : statusConexao.conectado === false ? "bg-red-500" : "bg-neutral-300";
  const textoConexao = statusConexao.conectado
    ? apelidoInstancia || statusConexao.nome || "WhatsApp conectado"
    : statusConexao.conectado === false
      ? "WhatsApp desconectado"
      : "WhatsApp — sem status";

  return (
    <div className="min-h-screen bg-neutral-50 sm:flex">
      <AutoRefresh />
      <SidebarShell
        titulo={
          <div className="sm:mb-1">
            <p className="text-sm font-semibold tracking-tight text-teal-800">{clinicaAtual?.nome ?? "Clínica"}</p>
            <p className="text-xs text-neutral-400">CRM · Atendimento</p>
          </div>
        }
        nav={<SidebarNav permissoes={Array.from(sessao.permissoes)} naoLidas={naoLidas} alertas={resumoAlertas?.relevantes ?? 0} />}
        rodape={
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${corConexao}`} />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-neutral-700">{textoConexao}</p>
                {statusConexao.numero && (
                  <p className="truncate text-[11px] text-neutral-400">{formatTelefone(statusConexao.numero)}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" title="Sessão ativa" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-neutral-900">{sessao.nome}</p>
                  <p className="truncate text-[11px] capitalize text-neutral-400">{sessao.perfil}</p>
                </div>
              </div>
              <LogoutButton />
            </div>
          </div>
        }
        rodapeCompacto={
          <div className="flex flex-col items-center gap-3 border-t border-neutral-100 pt-4">
            <span className={`h-2 w-2 rounded-full ${corConexao}`} title={textoConexao} />
            <span className="h-2 w-2 rounded-full bg-emerald-500" title={`${sessao.nome} · ${sessao.perfil}`} />
          </div>
        }
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end gap-1 border-b border-neutral-200 bg-white px-4 sm:px-6">
          <ThemeToggle />
          {resumoAlertas && <AlertasSino inicial={resumoAlertas} />}
          <Notificacoes inicial={notificacoes} />
          <span className="ml-1 truncate text-sm font-medium text-neutral-700">{sessao.nome}</span>
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
