import { NextResponse } from "next/server";
import { autorizarCanais, carregarCanalDaRota, statusHttpErroCanal } from "@/lib/canais-rotas";
import { definirCanalPrincipal } from "@/lib/canais";
import { registrarEvento } from "@/lib/auditoria";

export const runtime = "nodejs";

/** Marca o canal como principal (usado em disparo, alerta interno e demais envios sem conversa). Troca atômica no banco. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCanais("canais.configurar");
  if ("erro" in auth) return auth.erro;

  const canal = await carregarCanalDaRota(auth, context.params);
  if ("erro" in canal) return canal.erro;

  const resultado = await definirCanalPrincipal(auth.clinicaId, canal.id);
  if (!resultado.ok) return NextResponse.json(resultado, { status: statusHttpErroCanal(resultado.error) });

  await registrarEvento({
    clinicaId: auth.clinicaId,
    atorId: auth.sessao.atendenteId,
    atorPerfil: auth.sessao.perfil,
    evento: "CHANNEL_UPDATED",
    alvoId: canal.id,
    detalhes: { principal: true },
  });
  return NextResponse.json({ ok: true });
}
