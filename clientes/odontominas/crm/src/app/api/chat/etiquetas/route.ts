import { NextResponse } from "next/server";
import { requireSessao } from "@/lib/autorizacao";
import { criarEtiqueta, listarEtiquetas } from "@/lib/etiquetas";
import { getClinicaId } from "@/lib/clinica";

export const runtime = "nodejs";

export async function GET() {
  const authSessao = await requireSessao();
  if ("erro" in authSessao) return authSessao.erro;
  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const etiquetas = await listarEtiquetas(clinicaId);
  return NextResponse.json({ ok: true, etiquetas });
}

export async function POST(request: Request) {
  const authSessao = await requireSessao();
  if ("erro" in authSessao) return authSessao.erro;
  let body: { nome?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.nome) {
    return NextResponse.json({ ok: false, error: "nome_vazio" }, { status: 400 });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const resultado = await criarEtiqueta(clinicaId, body.nome);
  if (!resultado.ok) {
    const httpStatus = resultado.error === "nome_vazio" ? 400 : resultado.error === "ja_existe" ? 409 : 503;
    return NextResponse.json(resultado, { status: httpStatus });
  }

  return NextResponse.json(resultado);
}
