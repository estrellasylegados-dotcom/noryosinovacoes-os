import { NextResponse } from "next/server";
import { getClinicaId } from "@/lib/clinica";
import { requirePermission } from "@/lib/autorizacao";
import { buscarSlaConfig, salvarSlaConfig, type SalvarSlaConfigInput } from "@/lib/sla";

export const runtime = "nodejs";

/** Config de SLA (seção 48 do pedido) — ver quem enxerga cada permissão em `configuracoes/sla/page.tsx`. */
export async function GET() {
  const auth = await requirePermission("sla.visualizar");
  if ("erro" in auth) return auth.erro;

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const config = await buscarSlaConfig(clinicaId);
  return NextResponse.json({ ok: true, config });
}

export async function PUT(request: Request) {
  const auth = await requirePermission("sla.configurar");
  if ("erro" in auth) return auth.erro;

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
