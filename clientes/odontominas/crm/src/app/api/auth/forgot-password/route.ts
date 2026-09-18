import { NextResponse } from "next/server";
import { solicitarResetSenha } from "@/lib/reset-senha";
import { enviarEmailResetSenha } from "@/lib/email";
import { estaBloqueado, registrarFalha } from "@/lib/rate-limit-login";

export const runtime = "nodejs";

function getIpCliente(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || "desconhecido";
}

/** Esqueci minha senha (seção 27 do pedido) — resposta sempre genérica, nunca revela se o e-mail existe. */
export async function POST(request: Request) {
  const ip = getIpCliente(request);
  const chave = `forgot-password:${ip}`;
  const bloqueio = estaBloqueado(chave);

  const RESPOSTA_GENERICA = { ok: true, message: "Se existir uma conta associada a este e-mail, enviaremos instruções." };

  if (bloqueio.bloqueado) {
    // Mesmo aqui a resposta não muda de formato — só o rate limit real (429)
    // pra automação, nunca um texto diferente pra enumeração.
    return NextResponse.json({ ok: false, error: "muitas_tentativas" }, { status: 429 });
  }
  registrarFalha(chave);

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(RESPOSTA_GENERICA);
  }

  const email = (body.email ?? "").trim();
  if (!email) return NextResponse.json(RESPOSTA_GENERICA);

  const resultado = await solicitarResetSenha(email);
  if (resultado) {
    await enviarEmailResetSenha(email, resultado.nome, resultado.tokenBruto);
  }

  return NextResponse.json(RESPOSTA_GENERICA);
}
