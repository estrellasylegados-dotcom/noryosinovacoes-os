import { redirect } from "next/navigation";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { atorDaSessao, can } from "@/lib/autorizacao";
import { buscarBoard } from "@/lib/kanban";
import { listarAtendentes } from "@/lib/atendentes";
import { listarCanais } from "@/lib/canais";
import { listarEtiquetas } from "@/lib/etiquetas";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";

export const dynamic = "force-dynamic";

/**
 * Kanban comercial: estágio do lead (oportunidade), separado de tags e do
 * status da conversa. A página só busca o estado inicial; drag-and-drop e
 * ações rodam contra /api/kanban/* (o backend valida tudo de novo).
 */
export default async function KanbanPage({ searchParams }: { searchParams: Promise<{ pipeline?: string; card?: string }> }) {
  const [sessao, clinicaId, { pipeline, card }] = await Promise.all([getSessaoAtual(), getClinicaId(), searchParams]);

  if (!sessao || !can(sessao, "kanban.visualizar")) redirect("/");

  if (!clinicaId || sessao.clinicaId !== clinicaId) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">Não consegui abrir o Kanban desta clínica. Confira a conta e as variáveis do Supabase.</p>
      </main>
    );
  }

  const [resultado, atendentes, canais, etiquetas] = await Promise.all([
    buscarBoard(clinicaId, atorDaSessao(sessao), { pipelineId: pipeline }),
    listarAtendentes(clinicaId),
    listarCanais(clinicaId),
    listarEtiquetas(clinicaId),
  ]);

  if (!resultado.ok) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">Não consegui carregar o Kanban agora. O Chat continua funcionando; tente de novo em instantes.</p>
      </main>
    );
  }

  return (
    <KanbanBoard
      boardInicial={resultado.board}
      atendentes={atendentes.filter((a) => a.status === "active").map((a) => ({ id: a.id, nome: a.nome }))}
      canais={canais.filter((c) => c.ativo).map((c) => ({ id: c.id, nome: c.nome }))}
      etiquetas={etiquetas}
      permissoes={Array.from(sessao.permissoes)}
      atendenteId={sessao.atendenteId}
      cardInicialId={card && resultado.board.cards.some((c) => c.id === card) ? card : null}
    />
  );
}
