import { NextResponse } from "next/server";
import { requireSessao } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { pausarAgenteManual, retomarAgente } from "@/lib/agentes";

/** "Pausar IA" / "Retomar IA" no Chat ao Vivo — controle manual, independente da pausa temporária automática. */
export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authSessao = await requireSessao();
  if ("erro" in authSessao) return authSessao.erro;
  const { id } = await context.params;

  let body: { acao?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (body.acao !== "pausar" && body.acao !== "retomar") {
    return NextResponse.json({ ok: false, error: "acao_invalida" }, { status: 400 });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const resultado =
    body.acao === "pausar" ? await pausarAgenteManual(clinicaId, id) : await retomarAgente(clinicaId, id);

  if (!resultado.ok) {
    const erro = "error" in resultado ? resultado.error : undefined;
    return NextResponse.json({ ok: false, error: erro }, { status: erro === "sem_agente_elegivel" ? 400 : 503 });
  }

  return NextResponse.json({ ok: true });
}
