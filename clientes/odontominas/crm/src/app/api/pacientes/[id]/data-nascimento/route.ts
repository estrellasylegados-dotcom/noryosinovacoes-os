import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { atualizarDataNascimento } from "@/lib/pacientes";

export const runtime = "nodejs";

/** Fase 3 — edição de data de nascimento na ficha do paciente. Qualquer sessão válida (admin ou atendente) pode editar, mesmo gate de dado cadastral básico. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const sessao = await getSessaoAtual();
  if (!sessao) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { dataNascimento?: string | null } | null;
  if (!body || body.dataNascimento === undefined) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

  const resultado = await atualizarDataNascimento(clinicaId, id, body.dataNascimento);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
