import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { clinicaDaSessao } from "@/lib/alertas-http";
import { buscarConfigDistribuicao, salvarConfigDistribuicao, type SalvarDistribuicaoInput } from "@/lib/distribuicao-automatica";

export const runtime = "nodejs";

async function autorizar() {
  const auth = await requirePermission("configuracoes.clinica");
  if ("erro" in auth) return auth;
  const clinicaId = clinicaDaSessao(auth.sessao, await getClinicaId());
  if (!clinicaId) return { erro: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  return { clinicaId, sessao: auth.sessao };
}

export async function GET() {
  const a = await autorizar();
  if ("erro" in a) return a.erro;
  return NextResponse.json({ ok: true, config: await buscarConfigDistribuicao(a.clinicaId) });
}

export async function PUT(request: Request) {
  const a = await autorizar();
  if ("erro" in a) return a.erro;

  const body = (await request.json().catch(() => null)) as SalvarDistribuicaoInput | null;
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const r = await salvarConfigDistribuicao(a.clinicaId, body, { atendenteId: a.sessao.atendenteId, perfil: a.sessao.perfil });
  if (!r.ok) {
    const status = r.error === "invalid_body" || r.error === "estrategia_invalida" ? 400 : 503;
    return NextResponse.json({ ok: false, error: r.error }, { status });
  }
  return NextResponse.json({ ok: true, config: r.config });
}
