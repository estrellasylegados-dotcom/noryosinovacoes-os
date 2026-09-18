import { NextResponse } from "next/server";
import { requireSessao } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { buscarNotificacoes } from "@/lib/notificacoes";

export const runtime = "nodejs";

export async function GET() {
  const authSessao = await requireSessao();
  if ("erro" in authSessao) return authSessao.erro;
  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const notificacoes = await buscarNotificacoes(clinicaId);
  return NextResponse.json({ ok: true, notificacoes });
}
