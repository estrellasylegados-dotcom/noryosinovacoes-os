import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { retomarDisparo } from "@/lib/disparos";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { id } = await context.params;
  const resultado = await retomarDisparo(clinicaId, id);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
