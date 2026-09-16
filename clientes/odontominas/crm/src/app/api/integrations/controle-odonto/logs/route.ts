import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { listarLogs } from "@/lib/controle-odonto/sync-log";

export const runtime = "nodejs";

async function exigirAdmin() {
  const sessao = await getSessaoAtual();
  return sessao?.papel === "admin";
}

export async function GET(request: Request) {
  if (!(await exigirAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const direction = searchParams.get("direction");
  const resource = searchParams.get("resource");

  const logs = await listarLogs(clinicaId, {
    status: status === "sucesso" || status === "erro" ? status : undefined,
    direction: direction === "entrada" || direction === "saida" ? direction : undefined,
    resource: resource ?? undefined,
  });

  return NextResponse.json({ ok: true, logs });
}
