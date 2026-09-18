import { NextResponse } from "next/server";
import { atorDaSessao, requireSessao, statusHttpErroConversa } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { iniciarConversaChat, listarConversasChat } from "@/lib/chat";

export const runtime = "nodejs";

/** Lista completa (sem paginação — mesmo padrão de src/lib/conversas.ts, escala de 1 clínica). O filtro/aba é aplicado no cliente. */
export async function GET() {
  const authSessao = await requireSessao();
  if ("erro" in authSessao) return authSessao.erro;
  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const conversas = await listarConversasChat(clinicaId, atorDaSessao(authSessao.sessao));
  return NextResponse.json({ ok: true, conversas });
}

/** "Nova conversa": acha-ou-cria paciente/conversa por telefone e manda a 1ª mensagem de verdade. */
export async function POST(request: Request) {
  const authSessao = await requireSessao();
  if ("erro" in authSessao) return authSessao.erro;
  let body: { telefone?: string; texto?: string; nome?: string; canalId?: string };
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

  const resultado = await iniciarConversaChat(clinicaId, body.telefone, body.texto, body.nome ?? null, atorDaSessao(authSessao.sessao), body.canalId ?? null);
  if (!resultado.ok) {
    return NextResponse.json(resultado, { status: statusHttpErroConversa(resultado.error) });
  }

  return NextResponse.json(resultado);
}
