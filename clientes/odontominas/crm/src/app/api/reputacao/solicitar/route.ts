import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { solicitarAvaliacaoGoogle } from "@/lib/reputacao-solicitacao";

export const runtime = "nodejs";

/** Ação manual (Fase 5) — admin e atendente podem disparar; só a URL/config é admin-only (ver /api/reputacao/config). */
export async function POST(request: Request) {
  const sessao = await getSessaoAtual();
  if (!sessao) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { pacienteId?: string } | null;
  if (!body?.pacienteId) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

  const resultado = await solicitarAvaliacaoGoogle(clinicaId, body.pacienteId);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
