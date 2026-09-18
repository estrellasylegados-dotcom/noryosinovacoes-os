import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { buscarExecucao, listarEventosExecucao } from "@/lib/fluxo-execucoes-consulta";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ execucaoId: string }> }) {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { execucaoId } = await context.params;
  const execucao = await buscarExecucao(clinicaId, execucaoId);
  if (!execucao) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const eventos = await listarEventosExecucao(clinicaId, execucaoId);
  return NextResponse.json({ ok: true, execucao, eventos });
}
