import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { pausarDisparo } from "@/lib/disparos";

export const runtime = "nodejs";

/** Pausa um disparo em andamento — o worker só continua depois de "Retomar". */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { id } = await context.params;
  const resultado = await pausarDisparo(clinicaId, id);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
