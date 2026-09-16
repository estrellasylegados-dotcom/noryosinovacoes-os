import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { runAppointmentsSync } from "@/lib/controle-odonto/sync";

export const runtime = "nodejs";

async function exigirAdmin() {
  const sessao = await getSessaoAtual();
  return sessao?.papel === "admin";
}

/** Botão "Sincronizar agora" do painel — mesma rotina do cron (src/app/api/cron/controle-odonto-sync), serializada por lock. */
export async function POST() {
  if (!(await exigirAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const resultado = await runAppointmentsSync(clinicaId);
  return NextResponse.json(resultado);
}
