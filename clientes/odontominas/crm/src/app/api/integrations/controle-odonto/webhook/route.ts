import { NextResponse } from "next/server";
import { getControleOdontoConfig } from "@/lib/controle-odonto/config";
import { getControleOdontoCapabilities } from "@/lib/controle-odonto/capabilities";

export const runtime = "nodejs";

/**
 * Preparada, mas inativa — a área "Integrações - Webhooks" do manual
 * público do ControleODONTO está marcada "(FAZER)" (vazia, verificado em
 * 2026-09-16), sem contrato de payload nem de autenticação confirmado (ver
 * docs/integrations/controle-odonto.md). Responde 2xx rápido pra nunca
 * travar quem chamar, mas nunca processa nada enquanto
 * `canReceiveWebhooks` for `false`. Rota pública de propósito (ver
 * middleware.ts) — autenticação/validação de assinatura real entra junto
 * com o formato confirmado (ver pedido, seção WEBHOOK).
 */
export async function POST(request: Request) {
  const capabilities = getControleOdontoCapabilities(getControleOdontoConfig());

  if (!capabilities.canReceiveWebhooks) {
    console.error("[controle-odonto/webhook] recebido_mas_desabilitado");
    await request.text().catch(() => null);
    return NextResponse.json(
      { ok: false, error: "webhook_nao_configurado", mensagem: "Webhook recebido, mas ignorado: contrato ainda não confirmado." },
      { status: 200 }
    );
  }

  // Nenhum caminho de produção alcança este ponto hoje.
  await request.text().catch(() => null);
  return NextResponse.json({ ok: true });
}
