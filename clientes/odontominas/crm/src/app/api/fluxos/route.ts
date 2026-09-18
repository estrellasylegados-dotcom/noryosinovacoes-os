import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { criarFluxoComRascunhoInicial, listarFluxos, isStatusFluxoValido, type DadosNovoFluxo, type StatusFluxo } from "@/lib/fluxo-versoes";

export const runtime = "nodejs";

async function sessaoAdmin() {
  const sessao = await getSessaoAtual();
  return isAdminEquivalente(sessao) ? sessao : null;
}

export async function GET(request: Request) {
  if (!(await sessaoAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const statusBruto = searchParams.get("status");
  const status = statusBruto && isStatusFluxoValido(statusBruto) ? (statusBruto as StatusFluxo) : undefined;

  const fluxos = await listarFluxos(clinicaId, status ? { status } : undefined);
  return NextResponse.json({ ok: true, fluxos });
}

type CorpoNovoFluxo = Partial<DadosNovoFluxo>;

export async function POST(request: Request) {
  const sessao = await sessaoAdmin();
  if (!sessao) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as CorpoNovoFluxo | null;
  if (!body || typeof body.nome !== "string") {
    return NextResponse.json({ ok: false, error: "campos_obrigatorios" }, { status: 400 });
  }

  const resultado = await criarFluxoComRascunhoInicial(clinicaId, body as DadosNovoFluxo, sessao.atendenteId);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
