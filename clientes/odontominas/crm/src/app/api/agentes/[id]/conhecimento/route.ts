import { NextResponse } from "next/server";
import { criarConhecimento, listarConhecimento } from "@/lib/agentes-conhecimento";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";

export const runtime = "nodejs";

async function exigirAdmin() {
  const sessao = await getSessaoAtual();
  return isAdminEquivalente(sessao);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await exigirAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await context.params;
  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const itens = await listarConhecimento(clinicaId, id);
  return NextResponse.json({ ok: true, itens });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await exigirAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await context.params;

  let body: { titulo?: string; conteudo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const resultado = await criarConhecimento(clinicaId, id, body.titulo ?? "", body.conteudo ?? "");
  if (!resultado.ok) return NextResponse.json(resultado, { status: 400 });

  return NextResponse.json(resultado, { status: 201 });
}
