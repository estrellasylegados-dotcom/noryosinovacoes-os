import { NextResponse } from "next/server";
import { criarAtendente, type DadosNovoAtendente } from "@/lib/atendentes";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";

export const runtime = "nodejs";

/** Criar conta de atendente é ação de gestão de equipe — só admin. */
async function exigirAdmin() {
  const sessao = await getSessaoAtual();
  return sessao?.papel === "admin";
}

export async function POST(request: Request) {
  if (!(await exigirAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  let body: DadosNovoAtendente;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const resultado = await criarAtendente(clinicaId, body);
  if (!resultado.ok) return NextResponse.json(resultado, { status: 400 });

  return NextResponse.json(resultado, { status: 201 });
}
