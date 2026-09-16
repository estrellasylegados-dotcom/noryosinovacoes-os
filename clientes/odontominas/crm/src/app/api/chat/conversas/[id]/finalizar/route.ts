import { NextResponse } from "next/server";
import { getClinicaId } from "@/lib/clinica";
import { finalizarAtendimento } from "@/lib/chat";
import { getSessaoAtual } from "@/lib/sessao-servidor";

/** "Finalizar Atendimento" no Chat ao Vivo: status resolvido + IA desligada da conversa, num clique só. */
export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const [clinicaId, sessao] = await Promise.all([getClinicaId(), getSessaoAtual()]);
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const resultado = await finalizarAtendimento(clinicaId, id, sessao?.atendenteId ?? null);
  if (!resultado.ok) {
    return NextResponse.json(resultado, { status: resultado.error === "not_found" ? 404 : 503 });
  }

  return NextResponse.json({ ok: true });
}
