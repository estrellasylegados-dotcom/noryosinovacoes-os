import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { criarDisparo, listarDisparos, type DadosNovoDisparo } from "@/lib/disparos";

export const runtime = "nodejs";

async function sessaoAdmin() {
  const sessao = await getSessaoAtual();
  return sessao?.papel === "admin" ? sessao : null;
}

export async function GET() {
  if (!(await sessaoAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const disparos = await listarDisparos(clinicaId);
  return NextResponse.json({ ok: true, disparos });
}

type CorpoNovoDisparo = Partial<DadosNovoDisparo>;

export async function POST(request: Request) {
  const sessao = await sessaoAdmin();
  if (!sessao) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as CorpoNovoDisparo | null;
  if (!body || typeof body.nome !== "string" || typeof body.mensagemTexto !== "string" || !body.filtro) {
    return NextResponse.json({ ok: false, error: "campos_obrigatorios" }, { status: 400 });
  }

  const resultado = await criarDisparo(
    clinicaId,
    {
      nome: body.nome,
      filtro: body.filtro,
      audienciaId: body.audienciaId ?? null,
      mensagemSalvaId: body.mensagemSalvaId ?? null,
      mensagemTexto: body.mensagemTexto,
      iniciarAgora: Boolean(body.iniciarAgora),
      campanhaId: body.campanhaId ?? null,
    },
    sessao.atendenteId
  );

  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
