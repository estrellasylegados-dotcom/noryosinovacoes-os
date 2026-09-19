import { NextResponse } from "next/server";
import { criarOportunidadeManual } from "@/lib/kanban";
import { autorizarKanban, lerJson } from "@/lib/kanban-http";
import { statusHttpKanban } from "@/lib/kanban-regras";

export const runtime = "nodejs";

/** POST /api/kanban/oportunidades { pacienteId, interesse? } — 409 se o paciente já tem oportunidade aberta. */
export async function POST(request: Request) {
  const a = await autorizarKanban("kanban.mover");
  if ("erro" in a) return a.erro;

  const body = await lerJson<{ pacienteId?: string; interesse?: string | null }>(request);
  if (!body || typeof body.pacienteId !== "string" || !body.pacienteId) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const r = await criarOportunidadeManual(a.clinicaId, a.ator, body.pacienteId, typeof body.interesse === "string" ? body.interesse.trim().slice(0, 120) : null);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: statusHttpKanban(r.error) });
  return NextResponse.json({ ok: true, oportunidadeId: r.oportunidadeId }, { status: 201 });
}
