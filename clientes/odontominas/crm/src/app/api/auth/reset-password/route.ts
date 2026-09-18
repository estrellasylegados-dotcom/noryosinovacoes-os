import { NextResponse } from "next/server";
import { redefinirSenha } from "@/lib/reset-senha";
import { enviarEmailSenhaAlterada } from "@/lib/email";
import { estaBloqueado, registrarFalha } from "@/lib/rate-limit-login";

export const runtime = "nodejs";

function getIpCliente(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || "desconhecido";
}

export async function POST(request: Request) {
  const ip = getIpCliente(request);
  const chave = `reset-password:${ip}`;
  const bloqueio = estaBloqueado(chave);
  if (bloqueio.bloqueado) {
    return NextResponse.json({ ok: false, error: "muitas_tentativas" }, { status: 429 });
  }
  registrarFalha(chave);

  let body: { token?: string; novaSenha?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const token = body.token ?? "";
  if (!token) return NextResponse.json({ ok: false, error: "token_invalido" }, { status: 400 });

  const resultado = await redefinirSenha(token, body.novaSenha ?? "");
  if (!resultado.ok) return NextResponse.json(resultado, { status: 400 });

  if (resultado.email) {
    await enviarEmailSenhaAlterada(resultado.email, resultado.nome);
  }

  return NextResponse.json({ ok: true });
}
