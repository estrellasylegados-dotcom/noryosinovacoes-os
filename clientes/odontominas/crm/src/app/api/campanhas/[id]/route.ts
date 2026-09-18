import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { atualizarCampanha, buscarCampanha, excluirCampanha, type DadosCampanha } from "@/lib/campanhas";
import { calcularPainelCampanha } from "@/lib/campanha-metricas";
import { listarDisparosPorCampanha } from "@/lib/disparos";
import { listarEventosCampanha } from "@/lib/campanha-eventos";

export const runtime = "nodejs";

async function sessaoAdmin() {
  const sessao = await getSessaoAtual();
  return isAdminEquivalente(sessao) ? sessao : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await sessaoAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { id } = await context.params;
  const campanha = await buscarCampanha(clinicaId, id);
  if (!campanha) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const [painel, disparos, eventos] = await Promise.all([
    calcularPainelCampanha(clinicaId, id),
    listarDisparosPorCampanha(clinicaId, id),
    listarEventosCampanha(clinicaId, id),
  ]);

  return NextResponse.json({ ok: true, campanha, painel, disparos, eventos });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const sessao = await sessaoAdmin();
  if (!sessao) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Partial<DadosCampanha> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

  const resultado = await atualizarCampanha(clinicaId, id, body, sessao.atendenteId);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const sessao = await sessaoAdmin();
  if (!sessao) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { id } = await context.params;
  const resultado = await excluirCampanha(clinicaId, id);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
