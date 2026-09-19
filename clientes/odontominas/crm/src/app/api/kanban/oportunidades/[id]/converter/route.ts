import { NextResponse } from "next/server";
import { moverParaTipo } from "@/lib/kanban";
import { autorizarKanban, lerJson, respostaMover } from "@/lib/kanban-http";

export const runtime = "nodejs";

/** POST /api/kanban/oportunidades/:id/converter { expectedVersion, idempotencyKey? } — conversão COMERCIAL (não é pagamento nem tratamento concluído). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const a = await autorizarKanban("kanban.mover");
  if ("erro" in a) return a.erro;
  const { id } = await context.params;

  const b = await lerJson<{ expectedVersion?: number; idempotencyKey?: string }>(request);
  if (!b || typeof b.expectedVersion !== "number") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  return respostaMover(
    await moverParaTipo(a.clinicaId, a.ator, id, "won", {
      versaoEsperada: b.expectedVersion,
      idempotencyKey: b.idempotencyKey ?? null,
      motivoPerdaId: null,
      observacao: null,
      origem: "manual",
    })
  );
}
