import { NextResponse } from "next/server";
import { getClinicaId } from "@/lib/clinica";
import { compararSenhas } from "@/lib/senha";
import { executarScannerTemporal } from "@/lib/fluxo-scanner-temporal";

/**
 * Fase 3 do motor de Fluxo de Conversa: dispara o scanner temporal genérico
 * (src/lib/fluxo-scanner-temporal.ts). Mesmo padrão de autenticação e
 * transporte de src/app/api/cron/reativacao/route.ts — segredo comparado em
 * tempo constante, sem sessão de painel. Quem chama: o cron do GitHub
 * Actions (.github/workflows/odontominas-crm-fluxo-temporal.yml), de hora em
 * hora — a janela de horário configurada por fluxo decide quando cada regra
 * processa de verdade (ver fluxo-scanner-temporal.ts).
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
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const resultado = await executarScannerTemporal(clinicaId);
  console.log("[cron/fluxo-temporal]", JSON.stringify(resultado));

  return NextResponse.json({ ok: true, ...resultado });
}
