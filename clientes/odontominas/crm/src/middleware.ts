import { NextResponse, type NextRequest } from "next/server";
import { lerSessao, NOME_COOKIE_SESSAO } from "@/lib/sessao";

/**
 * Gate de acesso a todo o painel (ver src/lib/sessao.ts). O webhook da
 * Evolution API e os crons ficam de fora de propósito: são chamadas
 * servidor-a-servidor, sem cookie de navegador — a autenticação de cada um
 * é o próprio segredo validado dentro da rota (apikey da Evolution;
 * CRON_SECRET nos crons). O webhook do ControleODONTO também é público
 * (mesma razão), mas hoje só responde "desabilitado" — ver
 * src/lib/controle-odonto/capabilities.ts.
 */
const ROTAS_PUBLICAS = [
  "/login",
  "/api/login",
  "/api/webhook/evolution",
  "/api/cron/reativacao",
  "/api/cron/fluxo-temporal",
  "/api/integrations/controle-odonto/webhook",
  "/api/cron/controle-odonto-sync",
];

function isRotaPublica(pathname: string): boolean {
  return ROTAS_PUBLICAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isRotaPublica(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(NOME_COOKIE_SESSAO)?.value;
  const sessao = await lerSessao(token);

  if (!sessao) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
