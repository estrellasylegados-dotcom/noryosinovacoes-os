import { NextResponse } from "next/server";
import { autorizarFluxos } from "@/lib/fluxo-http";
import { registrarEvento } from "@/lib/auditoria";
import { criarFluxoComRascunhoInicial, listarFluxos, isStatusFluxoValido, type DadosNovoFluxo, type StatusFluxo } from "@/lib/fluxo-versoes";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await autorizarFluxos("automacoes.visualizar");
  if ("erro" in auth) return auth.erro;
  const { clinicaId } = auth;

  const { searchParams } = new URL(request.url);
  const statusBruto = searchParams.get("status");
  const status = statusBruto && isStatusFluxoValido(statusBruto) ? (statusBruto as StatusFluxo) : undefined;

  const fluxos = await listarFluxos(clinicaId, status ? { status } : undefined);
  return NextResponse.json({ ok: true, fluxos });
}

type CorpoNovoFluxo = Partial<DadosNovoFluxo>;

export async function POST(request: Request) {
  const auth = await autorizarFluxos("automacoes.criar");
  if ("erro" in auth) return auth.erro;
  const { clinicaId, sessao } = auth;

  const body = (await request.json().catch(() => null)) as CorpoNovoFluxo | null;
  if (!body || typeof body.nome !== "string") {
    return NextResponse.json({ ok: false, error: "campos_obrigatorios" }, { status: 400 });
  }

  const resultado = await criarFluxoComRascunhoInicial(clinicaId, body as DadosNovoFluxo, sessao.atendenteId);
  if (resultado.ok) await registrarEvento({ clinicaId, atorId: sessao.atendenteId, evento: "AUTOMATION_CREATED", alvoId: resultado.id });
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
