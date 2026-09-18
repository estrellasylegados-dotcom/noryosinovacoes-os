import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { vincularCampanhaPaciente } from "@/lib/pacientes";

export const runtime = "nodejs";

/** Vínculo manual paciente↔campanha (item 14) — admin só, mesmo gate de "Ferramentas". */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { campanhaId?: string | null } | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

  const resultado = await vincularCampanhaPaciente(clinicaId, id, body.campanhaId ?? null);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
