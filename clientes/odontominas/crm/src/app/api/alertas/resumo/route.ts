import { NextResponse } from "next/server";
import { resumirAlertas } from "@/lib/alertas-consulta";
import { autorizarAlertas } from "@/lib/alertas-http";

export const runtime = "nodejs";

/** GET /api/alertas/resumo — contadores + últimos críticos/atenção (sino do cabeçalho). Só o que a pessoa pode ver. */
export async function GET() {
  const a = await autorizarAlertas("alertas.visualizar");
  if ("erro" in a) return a.erro;
  return NextResponse.json({ ok: true, ...(await resumirAlertas(a.clinicaId, a.ator)) });
}
