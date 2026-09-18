import { NextResponse } from "next/server";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { buscarSlaConfig, salvarSlaConfig, type SalvarSlaConfigInput } from "@/lib/sla";

export const runtime = "nodejs";

/** Config de SLA — só admin, mesmo gate de /api/clinica/horario e /api/reputacao/config. */
async function exigirAdmin() {
  const sessao = await getSessaoAtual();
  return sessao?.papel === "admin";
}

export async function GET() {
  if (!(await exigirAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const config = await buscarSlaConfig(clinicaId);
  return NextResponse.json({ ok: true, config });
}

export async function PUT(request: Request) {
  if (!(await exigirAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  let body: SalvarSlaConfigInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const resultado = await salvarSlaConfig(clinicaId, body);
  if (!resultado.ok) return NextResponse.json(resultado, { status: 400 });

  return NextResponse.json(resultado);
}
