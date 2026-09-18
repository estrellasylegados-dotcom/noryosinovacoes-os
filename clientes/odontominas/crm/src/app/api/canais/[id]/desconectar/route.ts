import { NextResponse } from "next/server";
import { autorizarCanais, carregarCanalDaRota } from "@/lib/canais-rotas";
import { PROVIDER_EVOLUTION, verificarSaudeCanal } from "@/lib/canais";
import { desconectarInstancia } from "@/lib/evolution-status";
import { registrarEvento } from "@/lib/auditoria";

export const runtime = "nodejs";

/** Derruba a sessão do WhatsApp deste canal (precisa de QR novo pra voltar). A confirmação fica no botão da UI. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCanais("canais.desconectar");
  if ("erro" in auth) return auth.erro;

  const canal = await carregarCanalDaRota(auth, context.params);
  if ("erro" in canal) return canal.erro;
  if (canal.provider !== PROVIDER_EVOLUTION) {
    return NextResponse.json({ ok: false, error: "provider_nao_suportado" }, { status: 409 });
  }

  const resultado = await desconectarInstancia(canal.providerInstanceId);
  if (!resultado.ok) return NextResponse.json(resultado, { status: 503 });

  await verificarSaudeCanal(canal);
  await registrarEvento({
    clinicaId: auth.clinicaId,
    atorId: auth.sessao.atendenteId,
    atorPerfil: auth.sessao.perfil,
    evento: "CHANNEL_DISCONNECTED",
    alvoId: canal.id,
  });
  return NextResponse.json({ ok: true });
}
