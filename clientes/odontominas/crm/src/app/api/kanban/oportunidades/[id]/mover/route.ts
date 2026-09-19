import { NextResponse } from "next/server";
import { moverOportunidade } from "@/lib/kanban";
import { autorizarKanban, lerJson, respostaMover } from "@/lib/kanban-http";

export const runtime = "nodejs";

/**
 * POST /api/kanban/oportunidades/:id/mover { stageId, expectedVersion, idempotencyKey?, motivoPerdaId?, observacao? }
 * 409 = alguém mexeu antes (versão mudou): a UI recarrega o card.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const a = await autorizarKanban("kanban.mover");
  if ("erro" in a) return a.erro;
  const { id } = await context.params;

  const b = await lerJson<{ stageId?: string; expectedVersion?: number; idempotencyKey?: string; motivoPerdaId?: string; observacao?: string }>(request);
  if (!b || typeof b.stageId !== "string" || typeof b.expectedVersion !== "number") {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  return respostaMover(
    await moverOportunidade(a.clinicaId, a.ator, id, {
      estagioId: b.stageId,
      versaoEsperada: b.expectedVersion,
      idempotencyKey: b.idempotencyKey ?? null,
      motivoPerdaId: b.motivoPerdaId ?? null,
      observacao: b.observacao ?? null,
      origem: "manual",
    })
  );
}
