import { NextResponse } from "next/server";
import { moverParaTipo } from "@/lib/kanban";
import { autorizarKanban, lerJson, respostaMover } from "@/lib/kanban-http";

export const runtime = "nodejs";

/** POST /api/kanban/oportunidades/:id/perder { expectedVersion, motivoPerdaId, observacao?, idempotencyKey? } — motivo estruturado é obrigatório. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const a = await autorizarKanban("kanban.mover");
  if ("erro" in a) return a.erro;
  const { id } = await context.params;

  const b = await lerJson<{ expectedVersion?: number; idempotencyKey?: string; motivoPerdaId?: string; observacao?: string }>(request);
  if (!b || typeof b.expectedVersion !== "number") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  return respostaMover(
    await moverParaTipo(a.clinicaId, a.ator, id, "lost", {
      versaoEsperada: b.expectedVersion,
      idempotencyKey: b.idempotencyKey ?? null,
      motivoPerdaId: b.motivoPerdaId ?? null,
      observacao: b.observacao ?? null,
      origem: "manual",
    })
  );
}
