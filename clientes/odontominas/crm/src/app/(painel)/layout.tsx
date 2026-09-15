import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { buscarStatusConexao } from "@/lib/evolution-status";
import { formatTelefone } from "@/lib/tempo";
import { AutoRefresh } from "@/components/AutoRefresh";
import { LogoutButton } from "@/components/LogoutButton";
import { SidebarNav } from "@/components/SidebarNav";

/**
 * Casca visual de todo o painel logado: menu lateral (nav + status de
 * conexão do WhatsApp + identidade de quem entrou), aplicada via route group
 * a todas as páginas protegidas (o middleware já barra sem sessão — este
 * redirect aqui é defesa em profundidade, um Server Component não confia
 * cegamente no header de quem chamou).
 */
export default async function PainelLayout({ children }: { children: ReactNode }) {
  const [sessao, statusConexao] = await Promise.all([getSessaoAtual(), buscarStatusConexao()]);

  if (!sessao) redirect("/login");

  return (
    <div className="min-h-screen bg-neutral-50 sm:flex">
      <AutoRefresh />
      <aside className="flex flex-col gap-4 border-b border-neutral-200 bg-white px-4 py-4 sm:h-screen sm:w-60 sm:shrink-0 sm:justify-between sm:border-b-0 sm:border-r sm:px-5 sm:py-6">
        <div>
          <div className="mb-5">
            <p className="text-sm font-semibold tracking-tight text-teal-800">OdontoMinas</p>
            <p className="text-xs text-neutral-400">CRM · Atendimento</p>
          </div>
          <SidebarNav papel={sessao.papel} />
        </div>

        <div className="space-y-3 border-t border-neutral-100 pt-4 sm:mt-auto">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                statusConexao.conectado
                  ? "bg-emerald-500"
                  : statusConexao.conectado === false
                    ? "bg-red-500"
                    : "bg-neutral-300"
              }`}
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-neutral-700">
                {statusConexao.conectado
                  ? "WhatsApp conectado"
                  : statusConexao.conectado === false
                    ? "WhatsApp desconectado"
                    : "WhatsApp — sem status"}
              </p>
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
                <p className="truncate text-[11px] capitalize text-neutral-400">{sessao.papel}</p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
