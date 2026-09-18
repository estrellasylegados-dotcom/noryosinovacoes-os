import { NextResponse } from "next/server";
import { requireSessao } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { buscarResumoSlaHoje, buscarStatusSlaLista, registrarSlaBreachSeNovo } from "@/lib/sla";

export const runtime = "nodejs";

/** Aberto a qualquer sessão logada — dashboard "SLA Hoje" + lista pra badge/filtro/ordenação no Chat ao Vivo. */
export async function GET() {
  const authSessao = await requireSessao();
  if ("erro" in authSessao) return authSessao.erro;
  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const agora = new Date();
  const [resumo, lista] = await Promise.all([buscarResumoSlaHoje(clinicaId, agora), buscarStatusSlaLista(clinicaId, agora)]);

  for (const item of lista) {
    if (item.status.tipo === "breached") void registrarSlaBreachSeNovo(clinicaId, item.conversaId, item.status);
  }

  return NextResponse.json({ ok: true, resumo, lista });
}
