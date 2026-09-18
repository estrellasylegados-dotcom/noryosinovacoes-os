import { NextResponse } from "next/server";
import { excluirConhecimento } from "@/lib/agentes-conhecimento";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; itemId: string }> }) {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { itemId } = await context.params;
  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const resultado = await excluirConhecimento(clinicaId, itemId);
  return NextResponse.json(resultado);
}
