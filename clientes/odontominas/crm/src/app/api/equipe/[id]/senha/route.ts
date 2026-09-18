import { NextResponse } from "next/server";
import { trocarSenhaAtendente } from "@/lib/atendentes";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";

export const runtime = "nodejs";

/** Admin define senha nova pra outra conta — ver nota em atendentes.ts sobre não ser o reset self-service. */
async function exigirAdmin() {
  const sessao = await getSessaoAtual();
  return sessao?.papel === "admin";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await exigirAdmin())) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await context.params;

  let body: { novaSenha?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const resultado = await trocarSenhaAtendente(clinicaId, id, body.novaSenha ?? "");
  if (!resultado.ok) return NextResponse.json(resultado, { status: resultado.error === "not_found" ? 404 : 400 });

  return NextResponse.json(resultado);
}
