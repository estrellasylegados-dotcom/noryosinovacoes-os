import { NextResponse } from "next/server";
import { autorizarFluxos } from "@/lib/fluxo-http";
import { buscarContatosParaTeste } from "@/lib/fluxo-contatos-teste";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await autorizarFluxos("automacoes.editar");
  if ("erro" in auth) return auth.erro;
  const { clinicaId } = auth;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const contatos = await buscarContatosParaTeste(clinicaId, q);
  return NextResponse.json({ ok: true, contatos });
}
