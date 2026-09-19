import { NextResponse } from "next/server";
import { getClinicaId } from "@/lib/clinica";
import { compararSenhas } from "@/lib/senha";
import { verificarAlertasComLock } from "@/lib/alertas-verificador";

/**
 * Dispara UMA verificação de alertas sob demanda (o worker in-process já roda
 * a cada minuto — src/lib/alertas-worker.ts). Existe pra teste controlado em
 * produção e pra recuperar de worker parado. Mesmo padrão de autenticação dos
 * outros crons (segredo em tempo constante, sem sessão de painel) e mesmo
 * lock do worker: nunca duas verificações ao mesmo tempo.
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

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  return NextResponse.json({ ok: true, ...(await verificarAlertasComLock(clinicaId)) });
}
