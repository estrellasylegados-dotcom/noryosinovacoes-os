import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { buscarContatosParaTeste } from "@/lib/fluxo-contatos-teste";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const contatos = await buscarContatosParaTeste(clinicaId, q);
  return NextResponse.json({ ok: true, contatos });
}
