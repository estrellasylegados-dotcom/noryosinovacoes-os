import { NextResponse } from "next/server";
import { buscarNotasInternas, criarNotaInterna } from "@/lib/notas-internas";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const notas = await buscarNotasInternas(clinicaId, id);
  if (notas === null) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true, notas });
}

/** Autoria vem da sessão (nunca do body) — não dá pra assinar nota em nome de outro atendente. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  let body: { texto?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const [clinicaId, sessao] = await Promise.all([getClinicaId(), getSessaoAtual()]);
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const resultado = await criarNotaInterna(clinicaId, id, sessao?.atendenteId ?? null, body.texto ?? "");
  if (!resultado.ok) {
    const httpStatus = resultado.error === "not_found" ? 404 : resultado.error?.startsWith("texto") ? 400 : 503;
    return NextResponse.json(resultado, { status: httpStatus });
  }

  return NextResponse.json(resultado, { status: 201 });
}
