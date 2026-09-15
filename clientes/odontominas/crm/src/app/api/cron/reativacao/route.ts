import { NextResponse } from "next/server";
import { getClinicaId } from "@/lib/clinica";
import { compararSenhas } from "@/lib/senha";
import { executarReativacao } from "@/lib/reativacao";

/**
 * Fase 5 do CRM: dispara a automação de reativação de paciente inativo
 * (src/lib/reativacao.ts). Rota server-a-servidor, sem sessão de painel —
 * mesmo padrão do webhook da Evolution: autenticação por segredo comparado
 * em tempo constante, não cookie. Quem chama: o cron do GitHub Actions
 * (.github/workflows/odontominas-crm-reativacao.yml), 1x por dia.
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

  const resultado = await executarReativacao(clinicaId);
  console.log("[cron/reativacao]", JSON.stringify(resultado));

  return NextResponse.json({ ok: true, ...resultado });
}
