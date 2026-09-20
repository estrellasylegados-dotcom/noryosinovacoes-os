import { NextResponse } from "next/server";
import { autorizarFluxos } from "@/lib/fluxo-http";
import { buscarExecucao, listarEventosExecucao } from "@/lib/fluxo-execucoes-consulta";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ execucaoId: string }> }) {
  const auth = await autorizarFluxos("automacoes.visualizar_execucoes");
  if ("erro" in auth) return auth.erro;
  const { clinicaId } = auth;

  const { execucaoId } = await context.params;
  const execucao = await buscarExecucao(clinicaId, execucaoId);
  if (!execucao) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const eventos = await listarEventosExecucao(clinicaId, execucaoId);
  return NextResponse.json({ ok: true, execucao, eventos });
}
