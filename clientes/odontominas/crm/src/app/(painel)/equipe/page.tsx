import { redirect } from "next/navigation";
import { buscarClinicaAtual, getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { buscarStatsAtendentes } from "@/lib/equipe";
import { formatDataHora, formatDuracao } from "@/lib/tempo";
import { can } from "@/lib/autorizacao";
import { PERFIS, podeAtribuirPerfil } from "@/lib/permissoes";
import { EquipeNovaConta } from "@/components/EquipeNovaConta";
import { EquipeCardAcoes } from "@/components/EquipeCardAcoes";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  invited: "Convite pendente",
  pending_approval: "Aguardando aprovação",
  active: "Ativa",
  blocked: "Bloqueada",
  disabled: "Desativada",
};

/** Quem atendeu quanto — precisa de `usuarios.visualizar` (Dona/Gerente/Noryos Admin/Suporte por padrão). Redirect real, não só esconder o link (backend é autoridade). */
export default async function EquipePage() {
  const [sessao, clinicaId] = await Promise.all([getSessaoAtual(), getClinicaId()]);

  if (!can(sessao, "usuarios.visualizar")) {
    redirect("/");
  }

  const perfisAtribuiveis = sessao ? PERFIS.filter((p) => podeAtribuirPerfil(sessao.perfil, p)) : [];

  if (!clinicaId) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">
          Não consegui conectar ao banco do CRM. Confira as variáveis de ambiente do Supabase.
        </p>
      </main>
    );
  }

  const [stats, clinicaAtual] = await Promise.all([buscarStatsAtendentes(clinicaId), buscarClinicaAtual()]);

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Equipe</h1>
            <p className="text-sm text-neutral-500">{clinicaAtual?.nome ?? "Clínica"} — atendimento por secretária</p>
          </div>
          <EquipeNovaConta perfisAtribuiveis={perfisAtribuiveis} />
        </header>

        {stats.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-400">
            Nenhum atendente cadastrado ainda.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((a) => (
              <div key={a.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-neutral-900">{a.nome}</p>
                    <p className="text-xs capitalize text-neutral-400">{a.perfil}</p>
                    {a.email && <p className="text-xs text-neutral-400">{a.email}</p>}
                  </div>
                  {a.status !== "active" && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-neutral-500">Hoje</dt>
                    <dd className="text-lg font-semibold text-neutral-900">{a.atendimentosHoje}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-neutral-500">No total</dt>
                    <dd className="text-lg font-semibold text-neutral-900">{a.conversasAtendidas}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-neutral-500">Tempo médio até responder</dt>
                    <dd className="font-medium text-neutral-900">
                      {a.tempoMedioRespostaMs === null ? "—" : formatDuracao(a.tempoMedioRespostaMs)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-neutral-500">Última atividade</dt>
                    <dd className="text-neutral-600">{formatDataHora(a.ultimaAtividade)}</dd>
                  </div>
                </dl>

                <EquipeCardAcoes
                  id={a.id}
                  nome={a.nome}
                  perfil={a.perfil}
                  status={a.status}
                  perfisAtribuiveis={perfisAtribuiveis}
                />
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-xs text-neutral-400">
          Conta como atendimento a troca de status feita no painel (é o que dá pra saber quem tratou
          cada conversa hoje). Resposta automática do WhatsApp entra no funil geral, mas não em nome de
          ninguém.
        </p>
      </div>
    </main>
  );
}
