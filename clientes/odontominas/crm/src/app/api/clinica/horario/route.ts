import { NextResponse } from "next/server";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { buscarConfiguracaoHorario, salvarConfiguracaoHorario, type PayloadHorario } from "@/lib/horario-atendimento";

export const runtime = "nodejs";

/**
 * Config de clínica (mexe em algo que futuramente vira SLA/automação) — só
 * admin, GET e PUT, mesmo gate de /api/reputacao/config. RBAC de hoje só
 * distingue admin/atendente (sem papel "Gerente" à parte ainda — ver
 * relatório da fatia); "Dona"/"Noryos Admin" mapeiam pra admin.
 */
async function exigirAdmin() {
  const sessao = await getSessaoAtual();
  return sessao?.papel === "admin";
}

export async function GET() {
  if (!(await exigirAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const config = await buscarConfiguracaoHorario(clinicaId);
  if (!config) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true, config });
}

export async function PUT(request: Request) {
  if (!(await exigirAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  let body: PayloadHorario;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const resultado = await salvarConfiguracaoHorario(clinicaId, body);
  if (!resultado.ok) return NextResponse.json(resultado, { status: 400 });

  return NextResponse.json(resultado);
}
