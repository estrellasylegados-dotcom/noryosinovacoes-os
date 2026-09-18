import { NextResponse } from "next/server";
import { atualizarConversaChat, type PatchConversaChat } from "@/lib/chat";
import { getClinicaId } from "@/lib/clinica";
import { isPrioridadeValida } from "@/lib/prioridade";
import { can, requireSessao } from "@/lib/autorizacao";

export const runtime = "nodejs";

type Body = {
  arquivada?: boolean;
  prioridade?: string;
  atribuidoAId?: string | null;
  naoLida?: boolean;
};

/**
 * Atualização parcial de uma conversa no Chat ao Vivo: arquivar, prioridade,
 * marcar lida. Responsável NÃO passa mais por aqui (era last-write-wins, sem
 * histórico): use as ações explícitas /assumir, /transferir e /desatribuir.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSessao();
  if ("erro" in auth) return auth.erro;
  if (!can(auth.sessao, "conversas.visualizar_proprias") && !can(auth.sessao, "conversas.visualizar_todas")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (body.atribuidoAId !== undefined) {
    return NextResponse.json({ ok: false, error: "use_acoes_assumir_transferir" }, { status: 400 });
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
    ...(body.prioridade !== undefined ? { prioridade: body.prioridade } : {}),
  };

  const resultado = await atualizarConversaChat(clinicaId, id, patch);
  if (!resultado.ok) {
    return NextResponse.json(resultado, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
