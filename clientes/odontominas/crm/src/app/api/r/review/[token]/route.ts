import { NextResponse } from "next/server";
import { buscarPesquisaPorToken, registrarCliqueSeNovo, tokenExpirado } from "@/lib/reputacao-tracking";

export const runtime = "nodejs";

/**
 * Fase 5 (Reputação/Google Reviews) — rota pública (ver src/middleware.ts),
 * sem sessão: quem clica é o paciente pelo WhatsApp. O destino do redirect
 * NUNCA vem de query string nem de qualquer dado enviado pelo cliente — é
 * sempre `reputacao_config.google_review_url` lido do banco a partir do
 * token, então não existe open redirect possível por esta rota.
 */
function paginaAmigavel(titulo: string, mensagem: string): NextResponse {
  const html =
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><title>${titulo}</title></head>` +
    `<body style="font-family: system-ui, sans-serif; display:flex; min-height:100vh; align-items:center; justify-content:center; margin:0; background:#fafafa; color:#404040;">` +
    `<div style="text-align:center; padding:24px; max-width:360px;">` +
    `<h1 style="font-size:18px; margin-bottom:8px;">${titulo}</h1>` +
    `<p style="font-size:14px; color:#737373;">${mensagem}</p>` +
    `</div></body></html>`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!token) return paginaAmigavel("Link inválido", "Esse link de avaliação não é válido.");

  const lookup = await buscarPesquisaPorToken(token);
  if (!lookup) return paginaAmigavel("Link inválido", "Esse link de avaliação não é válido.");

  if (tokenExpirado(lookup)) {
    return paginaAmigavel(
      "Link expirado",
      "Esse link de avaliação expirou. Se ainda quiser deixar sua opinião, é só entrar em contato com a clínica."
    );
  }

  if (!lookup.googleReviewUrl) {
    return paginaAmigavel("Avaliação indisponível", "No momento não é possível abrir o link de avaliação. Entre em contato com a clínica.");
  }

  // Idempotente: só grava na 1ª vez (registrarCliqueSeNovo checa clicado_em),
  // cliques seguintes só redirecionam, sem duplicar registro nem métrica.
  await registrarCliqueSeNovo(lookup.pesquisaId, Boolean(lookup.clicadoEm));

  return NextResponse.redirect(lookup.googleReviewUrl, { status: 302 });
}
