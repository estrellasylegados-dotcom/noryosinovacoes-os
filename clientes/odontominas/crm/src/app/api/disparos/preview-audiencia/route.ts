import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { resolverAudiencia, type FiltroAudiencia } from "@/lib/audiencias";

export const runtime = "nodejs";

/** Passo 1 do wizard de Disparos: mostra encontrados/excluídos/elegíveis ao vivo, sem salvar nada. */
export async function POST(request: Request) {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { filtro?: FiltroAudiencia } | null;
  if (!body?.filtro) return NextResponse.json({ ok: false, error: "campos_obrigatorios" }, { status: 400 });

  const resultado = await resolverAudiencia(clinicaId, body.filtro);
  return NextResponse.json({ ok: true, resultado });
}
