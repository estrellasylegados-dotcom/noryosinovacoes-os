import { NextResponse } from "next/server";
import { getClinicaId } from "@/lib/clinica";
import { iniciarConversaChat, listarConversasChat } from "@/lib/chat";

export const runtime = "nodejs";

/** Lista completa (sem paginação — mesmo padrão de src/lib/conversas.ts, escala de 1 clínica). O filtro/aba é aplicado no cliente. */
export async function GET() {
  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const conversas = await listarConversasChat(clinicaId);
  return NextResponse.json({ ok: true, conversas });
}

/** "Nova conversa": acha-ou-cria paciente/conversa por telefone e manda a 1ª mensagem de verdade. */
export async function POST(request: Request) {
  let body: { telefone?: string; texto?: string; nome?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.telefone || !body.texto) {
    return NextResponse.json({ ok: false, error: "campos_obrigatorios" }, { status: 400 });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const resultado = await iniciarConversaChat(clinicaId, body.telefone, body.texto, body.nome ?? null);
  if (!resultado.ok) {
    const httpStatus = resultado.error === "telefone_invalido" || resultado.error === "texto_vazio" ? 400 : 503;
    return NextResponse.json(resultado, { status: httpStatus });
  }

  return NextResponse.json(resultado);
}
