import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { listarExecucoesFluxo } from "@/lib/fluxo-execucoes-consulta";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const isTestParam = searchParams.get("isTest");
  const limitParam = searchParams.get("limit");

  const execucoes = await listarExecucoesFluxo(clinicaId, id, {
    isTest: isTestParam === null ? undefined : isTestParam === "true",
    limit: limitParam ? Number(limitParam) : undefined,
  });

  return NextResponse.json({ ok: true, execucoes });
}
