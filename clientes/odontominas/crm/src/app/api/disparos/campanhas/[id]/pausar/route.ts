import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { pausarCampanha } from "@/lib/campanhas";

export const runtime = "nodejs";

/** Pausa uma campanha em andamento — o worker só continua depois de "Retomar". */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { id } = await context.params;
  const resultado = await pausarCampanha(clinicaId, id);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
