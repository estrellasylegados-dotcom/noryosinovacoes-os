import { NextResponse } from "next/server";
import { buscarConfigAlertas, salvarConfigAlertas, type SalvarConfigInput } from "@/lib/alertas-config";
import { autorizarAlertas, statusHttpAlerta } from "@/lib/alertas-http";

export const runtime = "nodejs";

export async function GET() {
  const a = await autorizarAlertas("alertas.configurar");
  if ("erro" in a) return a.erro;
  return NextResponse.json({ ok: true, config: await buscarConfigAlertas(a.clinicaId) });
}

/** PUT parcial: só os campos enviados mudam (tiposDesabilitados, semResponsavelMinutos, canalCarenciaMinutos, kanbanRegras). */
export async function PUT(request: Request) {
  const a = await autorizarAlertas("alertas.configurar");
  if ("erro" in a) return a.erro;

  const body = (await request.json().catch(() => null)) as SalvarConfigInput | null;
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const r = await salvarConfigAlertas(a.clinicaId, body, { atendenteId: a.sessao.atendenteId, perfil: a.sessao.perfil });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: statusHttpAlerta(r.error) });
  return NextResponse.json({ ok: true, config: await buscarConfigAlertas(a.clinicaId) });
}
