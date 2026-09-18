import { NextResponse } from "next/server";
import { requireSessao } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { avaliarStatusSlaConversa, registrarSlaBreachSeNovo } from "@/lib/sla";

export const runtime = "nodejs";

/** Aberto a qualquer sessão logada (mesmo critério de .../mensagens) — ver leitura de status, não é config. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authSessao = await requireSessao();
  if ("erro" in authSessao) return authSessao.erro;
  const { id } = await context.params;

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const status = await avaliarStatusSlaConversa(clinicaId, id, new Date());

  // Emissão do evento é explícita aqui, não escondida dentro de
  // avaliarStatusSlaConversa (que só lê) — ver relatório, seção idempotência.
  if (status.tipo === "breached") {
    void registrarSlaBreachSeNovo(clinicaId, id, status);
  }

  return NextResponse.json({ ok: true, status });
}
