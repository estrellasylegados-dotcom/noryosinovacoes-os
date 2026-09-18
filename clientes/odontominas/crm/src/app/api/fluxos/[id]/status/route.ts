import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { atualizarStatusFluxo, isStatusFluxoValido } from "@/lib/fluxo-versoes";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  if (!body || !body.status || !isStatusFluxoValido(body.status)) {
    return NextResponse.json({ ok: false, error: "status_invalido" }, { status: 400 });
  }

  const resultado = await atualizarStatusFluxo(clinicaId, id, body.status, sessao.atendenteId);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
