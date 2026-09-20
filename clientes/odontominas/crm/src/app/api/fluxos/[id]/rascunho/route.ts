import { NextResponse } from "next/server";
import { autorizarFluxos } from "@/lib/fluxo-http";
import { salvarRascunho } from "@/lib/fluxo-versoes";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await autorizarFluxos("automacoes.editar");
  if ("erro" in auth) return auth.erro;
  const { clinicaId } = auth;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { definicao?: unknown } | null;
  if (!body || body.definicao === undefined) {
    return NextResponse.json({ ok: false, error: "campos_obrigatorios" }, { status: 400 });
  }

  const resultado = await salvarRascunho(clinicaId, id, body.definicao);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
