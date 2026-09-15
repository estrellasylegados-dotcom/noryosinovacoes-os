import { NextResponse } from "next/server";
import { NOME_COOKIE_SESSAO } from "@/lib/sessao";

export async function POST() {
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set(NOME_COOKIE_SESSAO, "", { path: "/", maxAge: 0 });
  return resposta;
}
