import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { buscarConfigReputacao, salvarConfigReputacao, type SalvarConfigReputacaoInput } from "@/lib/reputacao-config";

export const runtime = "nodejs";

/** Ver e editar a config de Reputação — só admin edita (link oficial da clínica), mesmo gate de "Ferramentas". */
export async function GET() {
  const auth = await requirePermission("configuracoes.reputacao");
  if ("erro" in auth) return auth.erro;

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const config = await buscarConfigReputacao(clinicaId);
  return NextResponse.json({ ok: true, config });
}

export async function PUT(request: Request) {
  const auth = await requirePermission("configuracoes.reputacao");
  if ("erro" in auth) return auth.erro;

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as Partial<SalvarConfigReputacaoInput> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

  const resultado = await salvarConfigReputacao(clinicaId, {
    ativo: Boolean(body.ativo),
    googleReviewUrl: body.googleReviewUrl ?? null,
    rastrearCliques: body.rastrearCliques ?? true,
    delayHorasPadrao: body.delayHorasPadrao ?? null,
    automacaoAtendimentoConcluidoAtiva: Boolean(body.automacaoAtendimentoConcluidoAtiva),
    pesquisaAtiva: Boolean(body.pesquisaAtiva),
    pesquisaDelayMinutos: body.pesquisaDelayMinutos ?? 30,
    googleAtivo: Boolean(body.googleAtivo),
    googleDelayMinutos: body.googleDelayMinutos ?? 120,
    alertaRecuperacaoAtivo: body.alertaRecuperacaoAtivo !== false,
  });
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
