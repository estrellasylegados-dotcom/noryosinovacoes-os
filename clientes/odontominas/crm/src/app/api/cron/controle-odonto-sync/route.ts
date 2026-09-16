import { NextResponse } from "next/server";
import { getClinicaId } from "@/lib/clinica";
import { compararSenhas } from "@/lib/senha";
import { getControleOdontoConfig } from "@/lib/controle-odonto/config";
import { runAppointmentsSync } from "@/lib/controle-odonto/sync";

/**
 * Dispara a sincronização de agenda periodicamente — mesmo padrão de
 * autenticação do cron de reativação (src/app/api/cron/reativacao):
 * segredo comparado em tempo constante, sem sessão de painel. Reaproveita
 * o mesmo `CRON_SECRET` já configurado (Railway + GitHub Actions) em vez
 * de pedir um segredo novo.
 *
 * `CONTROLE_ODONTO_SYNC_ENABLED=false` (padrão) faz esta rota responder sem
 * tentar nada — é seguro registrar o agendamento no GitHub Actions antes
 * mesmo de a integração ter credencial real (ver pedido, seção FREQUÊNCIA).
 */
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const segredo = request.headers.get("x-cron-secret");
  if (!compararSenhas(segredo ?? "", process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const config = getControleOdontoConfig();
  if (!config.syncEnabled) {
    return NextResponse.json({ ok: true, status: "sync_desligado" });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const resultado = await runAppointmentsSync(clinicaId);
  console.log("[cron/controle-odonto-sync]", JSON.stringify(resultado));
  return NextResponse.json(resultado);
}
