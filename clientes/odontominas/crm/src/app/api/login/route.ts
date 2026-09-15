import { NextResponse } from "next/server";
import { criarTokenSessao, NOME_COOKIE_SESSAO, type Papel } from "@/lib/sessao";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { senha?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const senha = body.senha ?? "";
  let papel: Papel | null = null;
  if (senha && senha === process.env.PAINEL_SENHA_ADMIN) {
    papel = "admin";
  } else if (senha && senha === process.env.PAINEL_SENHA_ATENDENTE) {
    papel = "atendente";
  }

  if (!papel) {
    return NextResponse.json({ ok: false, error: "senha_invalida" }, { status: 401 });
  }

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
