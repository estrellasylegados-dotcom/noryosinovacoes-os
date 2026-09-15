import { NextResponse } from "next/server";
import { criarTokenSessao, NOME_COOKIE_SESSAO, type Papel } from "@/lib/sessao";
import { compararSenhas } from "@/lib/senha";
import { estaBloqueado, limparTentativas, registrarFalha } from "@/lib/rate-limit-login";

export const runtime = "nodejs";

/** Railway roda atrás de proxy: o IP real do cliente vem no x-forwarded-for. */
function getIpCliente(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || "desconhecido";
}

export async function POST(request: Request) {
  let body: { senha?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const ip = getIpCliente(request);
  const bloqueio = estaBloqueado(ip);
  if (bloqueio.bloqueado) {
    return NextResponse.json(
      { ok: false, error: "muitas_tentativas" },
      { status: 429, headers: { "Retry-After": String(bloqueio.retryAfterSec ?? 60) } }
    );
  }

  const senha = body.senha ?? "";
  let papel: Papel | null = null;
  if (senha && compararSenhas(senha, process.env.PAINEL_SENHA_ADMIN)) {
    papel = "admin";
  } else if (senha && compararSenhas(senha, process.env.PAINEL_SENHA_ATENDENTE)) {
    papel = "atendente";
  }

  if (!papel) {
    registrarFalha(ip);
    return NextResponse.json({ ok: false, error: "senha_invalida" }, { status: 401 });
  }

  limparTentativas(ip);
  const token = await criarTokenSessao(papel);
  const resposta = NextResponse.json({ ok: true, papel });
  resposta.cookies.set(NOME_COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return resposta;
}
