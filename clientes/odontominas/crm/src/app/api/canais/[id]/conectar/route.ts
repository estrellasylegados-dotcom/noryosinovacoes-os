import { NextResponse } from "next/server";
import { autorizarCanais, carregarCanalDaRota } from "@/lib/canais-rotas";
import { PROVIDER_EVOLUTION, verificarSaudeCanal } from "@/lib/canais";
import { buscarQrCode } from "@/lib/evolution-status";
import { registrarEvento } from "@/lib/auditoria";

export const runtime = "nodejs";

/** Gera o QR pra (re)conectar o número deste canal. Só devolve o QR; quem conecta é o celular da clínica. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCanais("canais.conectar");
  if ("erro" in auth) return auth.erro;

  const canal = await carregarCanalDaRota(auth, context.params);
  if ("erro" in canal) return canal.erro;
  if (canal.provider !== PROVIDER_EVOLUTION) {
    return NextResponse.json({ ok: false, error: "provider_nao_suportado" }, { status: 409 });
  }

  const qr = await buscarQrCode(canal.providerInstanceId);
  if (qr.conectado) await verificarSaudeCanal(canal);

  await registrarEvento({
    clinicaId: auth.clinicaId,
    atorId: auth.sessao.atendenteId,
    atorPerfil: auth.sessao.perfil,
    evento: "CHANNEL_RECONNECTED",
    alvoId: canal.id,
    detalhes: { conectado: qr.conectado, erro: qr.erro ?? null },
  });
  return NextResponse.json({ ok: !qr.erro || qr.conectado, conectado: qr.conectado, qrDataUrl: qr.qrDataUrl, erro: qr.erro ?? null });
}
