import { NextResponse } from "next/server";
import { getClinicaId, salvarApelidoInstancia } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";

export const runtime = "nodejs";

/** Apelido interno da instância — mesma sensibilidade de mexer na conexão, só admin. */
export async function PATCH(request: Request) {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: { apelido?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.apelido) {
    return NextResponse.json({ ok: false, error: "nome_vazio" }, { status: 400 });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const resultado = await salvarApelidoInstancia(clinicaId, body.apelido);
  if (!resultado.ok) {
    return NextResponse.json(resultado, { status: resultado.error === "update_failed" ? 503 : 400 });
  }

  return NextResponse.json({ ok: true });
}
