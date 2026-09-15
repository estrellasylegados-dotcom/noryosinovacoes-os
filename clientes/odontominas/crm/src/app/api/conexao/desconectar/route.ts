import { NextResponse } from "next/server";
import { desconectarInstancia } from "@/lib/evolution-status";
import { getSessaoAtual } from "@/lib/sessao-servidor";

export const runtime = "nodejs";

/** Derruba a sessão do WhatsApp conectado — só admin, mesma sensibilidade das outras ações de conexão. */
export async function POST() {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const resultado = await desconectarInstancia();
  if (!resultado.ok) {
    return NextResponse.json(resultado, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
