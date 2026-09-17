import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { registrarEventoCampanha, type TipoEventoCampanha } from "@/lib/campanha-eventos";

export const runtime = "nodejs";

/**
 * Registro manual de comparecimento/fechamento (item 18 do briefing) —
 * único jeito de preencher esses 2 marcos hoje, já que o ControleODONTO
 * ainda não tem credencial real (ver docs/integrations/controle-odonto.md).
 * `treatment_closed` sempre exige `valor` — nunca inventar receita.
 */
const TIPOS_MANUAIS: TipoEventoCampanha[] = ["appointment_attended", "treatment_closed"];

type CorpoEvento = { tipo?: string; pacienteId?: string; valor?: number };

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as CorpoEvento | null;
  if (!body || !body.tipo || !TIPOS_MANUAIS.includes(body.tipo as TipoEventoCampanha) || !body.pacienteId) {
    return NextResponse.json({ ok: false, error: "campos_obrigatorios" }, { status: 400 });
  }
  if (body.tipo === "treatment_closed" && (typeof body.valor !== "number" || body.valor <= 0)) {
    return NextResponse.json({ ok: false, error: "valor_obrigatorio" }, { status: 400 });
  }

  const resultado = await registrarEventoCampanha(clinicaId, id, body.tipo as TipoEventoCampanha, {
    pacienteId: body.pacienteId,
    valor: body.tipo === "treatment_closed" ? body.valor : null,
    registradoPor: sessao.atendenteId,
    metadata: { origem: "manual" },
  });

  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
