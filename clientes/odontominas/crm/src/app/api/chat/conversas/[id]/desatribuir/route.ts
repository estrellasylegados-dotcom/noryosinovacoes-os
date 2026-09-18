import { NextResponse } from "next/server";
import { atorDaSessao, requirePermission, statusHttpErroConversa } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { desatribuirConversa } from "@/lib/atribuicao";

export const runtime = "nodejs";

/** Devolve a conversa pra fila ("sem responsável"). Mesma regra de quem pode mexer no responsável que a transferência. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("conversas.transferir");
  if ("erro" in auth) return auth.erro;

  const { id } = await context.params;

  let body: { esperadoAtribuidoA?: string | null; motivo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (body.esperadoAtribuidoA === undefined) {
    return NextResponse.json({ ok: false, error: "campos_obrigatorios" }, { status: 400 });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const resultado = await desatribuirConversa(clinicaId, id, atorDaSessao(auth.sessao), body.esperadoAtribuidoA, body.motivo);
  if (!resultado.ok) return NextResponse.json(resultado, { status: statusHttpErroConversa(resultado.error) });
  return NextResponse.json({ ok: true });
}
