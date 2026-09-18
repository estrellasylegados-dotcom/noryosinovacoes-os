import { NextResponse } from "next/server";
import { getClinicaId } from "@/lib/clinica";
import { requirePermission } from "@/lib/autorizacao";
import { buscarConfiguracaoHorario, salvarConfiguracaoHorario, type PayloadHorario } from "@/lib/horario-atendimento";

export const runtime = "nodejs";

/** Horário de atendimento (seção 49 do pedido) — `configuracoes.horario`, não mais admin fixo. */
export async function GET() {
  const auth = await requirePermission("configuracoes.horario");
  if ("erro" in auth) return auth.erro;

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const config = await buscarConfiguracaoHorario(clinicaId);
  if (!config) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true, config });
}

export async function PUT(request: Request) {
  const auth = await requirePermission("configuracoes.horario");
  if ("erro" in auth) return auth.erro;

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
