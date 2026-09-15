import { NextResponse } from "next/server";
import { buscarMensagensChat, enviarRespostaChat } from "@/lib/chat";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const mensagens = await buscarMensagensChat(clinicaId, id);
  if (mensagens === null) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, mensagens });
}

/** Resposta manual pelo painel — envia de verdade pela Evolution API (ver src/lib/chat.ts). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  let body: { texto?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.texto) {
    return NextResponse.json({ ok: false, error: "texto_vazio" }, { status: 400 });
  }

  const [clinicaId, sessao] = await Promise.all([getClinicaId(), getSessaoAtual()]);
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const resultado = await enviarRespostaChat(clinicaId, id, body.texto, sessao?.atendenteId ?? null);
  if (!resultado.ok) {
    const httpStatus = resultado.error === "not_found" ? 404 : resultado.error === "texto_vazio" ? 400 : 503;
    return NextResponse.json(resultado, { status: httpStatus });
  }

  return NextResponse.json(resultado);
}
