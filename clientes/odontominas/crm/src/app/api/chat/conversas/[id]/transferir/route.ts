import { NextResponse } from "next/server";
import { atorDaSessao, requirePermission, statusHttpErroConversa } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { transferirConversa } from "@/lib/atribuicao";

export const runtime = "nodejs";

type Body = {
  /** Responsável que quem chamou VIU (null = viu sem responsável). Sem isso não há como detectar transferência concorrente. */
  esperadoAtribuidoA?: string | null;
  destinoId?: string;
  motivo?: string;
};

/** Transferência humano→humano, com validação de destino e proteção contra transferência concorrente (409 com o estado atual). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("conversas.transferir");
  if ("erro" in auth) return auth.erro;

  const { id } = await context.params;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!body.destinoId || body.esperadoAtribuidoA === undefined) {
    return NextResponse.json({ ok: false, error: "campos_obrigatorios" }, { status: 400 });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const resultado = await transferirConversa(clinicaId, id, atorDaSessao(auth.sessao), body.esperadoAtribuidoA, body.destinoId, body.motivo);
  if (!resultado.ok) {
    const mensagemErro =
      resultado.error === "conflito"
        ? `Esta conversa mudou de responsável${resultado.porNome ? ` (agora com ${resultado.porNome})` : ""}. Atualize e tente de novo.`
        : undefined;
    return NextResponse.json({ ...resultado, mensagemErro }, { status: statusHttpErroConversa(resultado.error) });
  }
  return NextResponse.json({ ok: true });
}
