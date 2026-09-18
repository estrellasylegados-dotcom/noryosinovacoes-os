import { NextResponse } from "next/server";
import { autorizarCanais, statusHttpErroCanal } from "@/lib/canais-rotas";
import { criarCanal, listarCanais, paraPublico } from "@/lib/canais";
import { registrarEvento } from "@/lib/auditoria";

export const runtime = "nodejs";

/** Lista os canais da clínica (sem `credencialRef`, nunca vai pro navegador). */
export async function GET() {
  const auth = await autorizarCanais(["canais.visualizar", "suporte.acesso_tecnico"]);
  if ("erro" in auth) return auth.erro;

  const canais = await listarCanais(auth.clinicaId);
  return NextResponse.json({ ok: true, canais: canais.map(paraPublico) });
}

/** Cadastra um canal WhatsApp (instância Evolution já criada no provider). O 1º canal da clínica vira o principal. */
export async function POST(request: Request) {
  const auth = await autorizarCanais("canais.configurar");
  if ("erro" in auth) return auth.erro;

  let body: { nome?: string; providerInstanceId?: string; credencialRef?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const resultado = await criarCanal(auth.clinicaId, {
    nome: body.nome ?? "",
    providerInstanceId: body.providerInstanceId ?? "",
    credencialRef: body.credencialRef ?? null,
  });
  if (!resultado.ok) return NextResponse.json(resultado, { status: statusHttpErroCanal(resultado.error) });

  await registrarEvento({
    clinicaId: auth.clinicaId,
    atorId: auth.sessao.atendenteId,
    atorPerfil: auth.sessao.perfil,
    evento: "CHANNEL_CREATED",
    alvoId: resultado.canal.id,
    detalhes: { nome: resultado.canal.nome, principal: resultado.canal.principal },
  });
  return NextResponse.json({ ok: true, canal: paraPublico(resultado.canal) });
}
