import { NextResponse } from "next/server";
import { buscarBoard } from "@/lib/kanban";
import { autorizarKanban } from "@/lib/kanban-http";
import { statusHttpKanban, type FiltrosKanban, type SlaKanban } from "@/lib/kanban-regras";

export const runtime = "nodejs";

const SLAS: SlaKanban[] = ["ok", "warning", "breached", "paused", "not_configured"];

/** GET /api/kanban?pipeline=&busca=&responsavel=&canal=&etiquetas=a,b&origem=&interesse=&sla=&de=&ate=&estagio= */
export async function GET(request: Request) {
  const a = await autorizarKanban("kanban.visualizar");
  if ("erro" in a) return a.erro;

  const q = new URL(request.url).searchParams;
  const sla = q.get("sla");
  const filtros: FiltrosKanban & { pipelineId?: string } = {
    pipelineId: q.get("pipeline") || undefined,
    busca: q.get("busca") || undefined,
    responsavelId: q.get("responsavel") || undefined,
    canalId: q.get("canal") || undefined,
    etiquetaIds: q.get("etiquetas")?.split(",").filter(Boolean),
    origem: q.get("origem") || undefined,
    interesse: q.get("interesse") || undefined,
    sla: sla && (SLAS as string[]).includes(sla) ? (sla as SlaKanban) : undefined,
    de: q.get("de") || undefined,
    ate: q.get("ate") || undefined,
    estagioId: q.get("estagio") || undefined,
  };

  const r = await buscarBoard(a.clinicaId, a.ator, filtros);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: statusHttpKanban(r.error) });
  return NextResponse.json({ ok: true, ...r.board });
}
