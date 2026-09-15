import { NextResponse } from "next/server";
import { atualizarConversaChat, type PatchConversaChat } from "@/lib/chat";
import { getClinicaId } from "@/lib/clinica";
import { isPrioridadeValida } from "@/lib/prioridade";

export const runtime = "nodejs";

type Body = {
  arquivada?: boolean;
  prioridade?: string;
  atribuidoAId?: string | null;
  naoLida?: boolean;
};

/** Atualização parcial de uma conversa no Chat ao Vivo: arquivar, prioridade, atribuição, marcar lida. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (body.prioridade !== undefined && !isPrioridadeValida(body.prioridade)) {
    return NextResponse.json({ ok: false, error: "prioridade_invalida" }, { status: 400 });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const patch: PatchConversaChat = {
    ...(body.arquivada !== undefined ? { arquivada: body.arquivada } : {}),
    ...(body.naoLida !== undefined ? { naoLida: body.naoLida } : {}),
    ...(body.atribuidoAId !== undefined ? { atribuidoAId: body.atribuidoAId } : {}),
    ...(body.prioridade !== undefined ? { prioridade: body.prioridade } : {}),
  };

  const resultado = await atualizarConversaChat(clinicaId, id, patch);
  if (!resultado.ok) {
    return NextResponse.json(resultado, { status: resultado.error === "atendente_invalido" ? 400 : 503 });
  }

  return NextResponse.json({ ok: true });
}
