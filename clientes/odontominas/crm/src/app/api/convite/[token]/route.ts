import { NextResponse } from "next/server";
import { aceitarConvite } from "@/lib/convites";
import { estaBloqueado, registrarFalha } from "@/lib/rate-limit-login";

export const runtime = "nodejs";

function getIpCliente(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || "desconhecido";
}

/** Aceitar convite e definir a 1ª senha (seções 17/25/26 do pedido) — página pública, o token é a própria autenticação. */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const ip = getIpCliente(request);
  const chave = `convite:${ip}`;
  const bloqueio = estaBloqueado(chave);
  if (bloqueio.bloqueado) {
    return NextResponse.json({ ok: false, error: "muitas_tentativas" }, { status: 429 });
  }
  registrarFalha(chave);

  const { token } = await context.params;

  let body: { novaSenha?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const resultado = await aceitarConvite(token, body.novaSenha ?? "");
  if (!resultado.ok) return NextResponse.json(resultado, { status: 400 });

  return NextResponse.json({ ok: true });
}
