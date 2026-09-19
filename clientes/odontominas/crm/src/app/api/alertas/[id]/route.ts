import { NextResponse } from "next/server";
import { buscarHistoricoAlerta } from "@/lib/alertas";
import { buscarAlertaVisivel } from "@/lib/alertas-consulta";
import { autorizarAlertas } from "@/lib/alertas-http";

export const runtime = "nodejs";

/** GET /api/alertas/:id — detalhe + histórico. Alerta fora do alcance da pessoa = 404 (não vaza que existe). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const a = await autorizarAlertas("alertas.visualizar");
  if ("erro" in a) return a.erro;
  const { id } = await context.params;

  const alerta = await buscarAlertaVisivel(a.clinicaId, a.ator, id);
  if (!alerta) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, alerta, historico: await buscarHistoricoAlerta(a.clinicaId, id) });
}
