import { NextResponse } from "next/server";
import { requireSessao } from "@/lib/autorizacao";
import { adicionarEtiquetaConversa, removerEtiquetaConversa } from "@/lib/etiquetas";
import { getClinicaId } from "@/lib/clinica";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authSessao = await requireSessao();
  if ("erro" in authSessao) return authSessao.erro;
  const { id } = await context.params;

  let body: { etiquetaId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.etiquetaId) {
    return NextResponse.json({ ok: false, error: "etiqueta_obrigatoria" }, { status: 400 });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const resultado = await adicionarEtiquetaConversa(clinicaId, id, body.etiquetaId);
  if (!resultado.ok) {
    return NextResponse.json(resultado, { status: resultado.error === "not_found" ? 404 : 503 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const authSessao = await requireSessao();
  if ("erro" in authSessao) return authSessao.erro;
  const { id } = await context.params;
  const etiquetaId = new URL(request.url).searchParams.get("etiquetaId");

  if (!etiquetaId) {
    return NextResponse.json({ ok: false, error: "etiqueta_obrigatoria" }, { status: 400 });
  }

  await removerEtiquetaConversa(id, etiquetaId);
  return NextResponse.json({ ok: true });
}
