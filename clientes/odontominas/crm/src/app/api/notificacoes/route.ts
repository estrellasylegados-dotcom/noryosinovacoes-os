import { NextResponse } from "next/server";
import { getClinicaId } from "@/lib/clinica";
import { buscarNotificacoes } from "@/lib/notificacoes";

export const runtime = "nodejs";

export async function GET() {
  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const notificacoes = await buscarNotificacoes(clinicaId);
  return NextResponse.json({ ok: true, notificacoes });
}
