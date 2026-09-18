import { NextResponse } from "next/server";
import { autorizarCanais, carregarCanalDaRota, statusHttpErroCanal } from "@/lib/canais-rotas";
import { atualizarCanal, paraPublico } from "@/lib/canais";
import { registrarEvento } from "@/lib/auditoria";

export const runtime = "nodejs";

/** Renomear e ativar/pausar. Pausar = o canal para de enviar (falha controlada, sem fallback pra outro número). */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCanais("canais.configurar");
  if ("erro" in auth) return auth.erro;

  const canal = await carregarCanalDaRota(auth, context.params);
  if ("erro" in canal) return canal.erro;

  let body: { nome?: string; ativo?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (body.nome === undefined && body.ativo === undefined) {
    return NextResponse.json({ ok: false, error: "nada_a_alterar" }, { status: 400 });
  }

  const resultado = await atualizarCanal(auth.clinicaId, canal.id, {
    ...(body.nome !== undefined ? { nome: body.nome } : {}),
    ...(body.ativo !== undefined ? { ativo: body.ativo } : {}),
  });
  if (!resultado.ok) return NextResponse.json(resultado, { status: statusHttpErroCanal(resultado.error) });

  const pausou = body.ativo === false && canal.ativo;
  await registrarEvento({
    clinicaId: auth.clinicaId,
    atorId: auth.sessao.atendenteId,
    atorPerfil: auth.sessao.perfil,
    evento: pausou ? "CHANNEL_PAUSED" : "CHANNEL_UPDATED",
    alvoId: canal.id,
    detalhes: { nomeAnterior: canal.nome, nome: resultado.canal.nome, ativo: resultado.canal.ativo },
  });
  return NextResponse.json({ ok: true, canal: paraPublico(resultado.canal) });
}
