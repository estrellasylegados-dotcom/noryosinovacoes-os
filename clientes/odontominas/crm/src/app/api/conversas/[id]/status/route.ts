import { NextResponse } from "next/server";
import { getClinicaId } from "@/lib/clinica";
import { atualizarStatus } from "@/lib/conversas";
import { isStatusValido } from "@/lib/status";

/**
 * Fase 3 do CRM: troca manual de status no painel — a "ação leve" que o
 * plano técnico previu (visibilidade + ação leve, sem chat 2-way completo).
 */

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.status || !isStatusValido(body.status)) {
    return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const resultado = await atualizarStatus(clinicaId, id, body.status);
  if (!resultado.ok) {
    const httpStatus = resultado.error === "not_found" ? 404 : 503;
    return NextResponse.json(resultado, { status: httpStatus });
  }

  return NextResponse.json({ ok: true });
}
