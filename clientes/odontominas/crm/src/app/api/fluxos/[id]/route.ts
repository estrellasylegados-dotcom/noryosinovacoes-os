import { NextResponse } from "next/server";
import { autorizarFluxos } from "@/lib/fluxo-http";
import { atualizarMetadadosFluxo, type DadosMetadadosFluxo } from "@/lib/fluxo-versoes";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await autorizarFluxos("automacoes.editar");
  if ("erro" in auth) return auth.erro;
  const { clinicaId } = auth;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as DadosMetadadosFluxo | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

  const resultado = await atualizarMetadadosFluxo(clinicaId, id, body);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
