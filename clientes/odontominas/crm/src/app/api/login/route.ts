import { NextResponse } from "next/server";
import { getClinicaId } from "@/lib/clinica";
import { buscarAtendentePorUsuario } from "@/lib/atendentes";
import { criarTokenSessao, NOME_COOKIE_SESSAO } from "@/lib/sessao";
import { HASH_DUMMY_TIMING, verificarSenha } from "@/lib/senha";
import { estaBloqueado, limparTentativas, registrarFalha } from "@/lib/rate-limit-login";

export const runtime = "nodejs";

/** Railway roda atrás de proxy: o IP real do cliente vem no x-forwarded-for. */
function getIpCliente(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || "desconhecido";
}

export async function POST(request: Request) {
  let body: { usuario?: string; senha?: string };
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

  const usuario = (body.usuario ?? "").trim().toLowerCase();
  const senha = body.senha ?? "";

  const clinicaId = await getClinicaId();
  const atendente = usuario && clinicaId ? await buscarAtendentePorUsuario(clinicaId, usuario) : null;

  // Roda verificarSenha mesmo quando o usuário não existe (contra o hash
  // fixo), senão "usuário não existe" responde mais rápido que "senha
  // errada" e um atacante descobre por tempo quais usuários são reais.
  const senhaValida = verificarSenha(senha, atendente?.senhaHash ?? HASH_DUMMY_TIMING);

  if (!atendente || !senhaValida) {
    registrarFalha(ip);
    return NextResponse.json({ ok: false, error: "credenciais_invalidas" }, { status: 401 });
  }

  limparTentativas(ip);
  const token = await criarTokenSessao(atendente.id, atendente.nome, atendente.papel);
  const resposta = NextResponse.json({ ok: true, papel: atendente.papel, nome: atendente.nome });
  resposta.cookies.set(NOME_COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return resposta;
}
