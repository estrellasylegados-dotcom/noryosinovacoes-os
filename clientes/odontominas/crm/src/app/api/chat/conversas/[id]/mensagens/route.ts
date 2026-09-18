import { NextResponse } from "next/server";
import { atorDaSessao, requireSessao, statusHttpErroConversa } from "@/lib/autorizacao";
import { buscarMensagensChat, enviarRespostaChat } from "@/lib/chat";
import { getClinicaId } from "@/lib/clinica";
import { requirePermission } from "@/lib/autorizacao";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authSessao = await requireSessao();
  if ("erro" in authSessao) return authSessao.erro;
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

/** Resposta manual pelo painel — envia de verdade pela Evolution API (ver src/lib/chat.ts). `conversas.assumir` (seção 51 do pedido). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("conversas.assumir");
  if ("erro" in auth) return auth.erro;
  const { sessao } = auth;

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

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const resultado = await enviarRespostaChat(clinicaId, id, body.texto, atorDaSessao(sessao));
  if (!resultado.ok) {
    return NextResponse.json(resultado, { status: statusHttpErroConversa(resultado.error) });
  }

  return NextResponse.json(resultado);
}
