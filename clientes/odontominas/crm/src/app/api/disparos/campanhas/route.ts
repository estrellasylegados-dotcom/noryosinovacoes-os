import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { criarCampanha, listarCampanhas, type DadosNovaCampanha } from "@/lib/campanhas";

export const runtime = "nodejs";

async function sessaoAdmin() {
  const sessao = await getSessaoAtual();
  return sessao?.papel === "admin" ? sessao : null;
}

export async function GET() {
  if (!(await sessaoAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const campanhas = await listarCampanhas(clinicaId);
  return NextResponse.json({ ok: true, campanhas });
}

type CorpoNovaCampanha = Partial<DadosNovaCampanha>;

export async function POST(request: Request) {
  const sessao = await sessaoAdmin();
  if (!sessao) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as CorpoNovaCampanha | null;
  if (!body || typeof body.nome !== "string" || typeof body.mensagemTexto !== "string" || !body.filtro) {
    return NextResponse.json({ ok: false, error: "campos_obrigatorios" }, { status: 400 });
  }

  const resultado = await criarCampanha(
    clinicaId,
    {
      nome: body.nome,
      filtro: body.filtro,
      audienciaId: body.audienciaId ?? null,
      mensagemSalvaId: body.mensagemSalvaId ?? null,
      mensagemTexto: body.mensagemTexto,
      iniciarAgora: Boolean(body.iniciarAgora),
    },
    sessao.atendenteId
  );

  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
