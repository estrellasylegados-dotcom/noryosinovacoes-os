import { NextResponse } from "next/server";
import { atualizarAtendente, buscarAtendentePorId, type StatusAtendente } from "@/lib/atendentes";
import { getClinicaId } from "@/lib/clinica";
import { requirePermission } from "@/lib/autorizacao";
import { podeAtribuirPerfil, type Perfil } from "@/lib/permissoes";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("usuarios.editar");
  if ("erro" in auth) return auth.erro;
  const { sessao } = auth;

  const { id } = await context.params;

  // Ninguém edita a própria conta por esta rota (evita auto-promoção e
  // autoexclusão acidental — seção 40) — Dona/Noryos Admin gerenciam outras
  // contas, não a própria, por aqui.
  if (id === sessao.atendenteId) {
    return NextResponse.json({ ok: false, error: "nao_pode_editar_a_propria_conta" }, { status: 403 });
  }

  let body: Partial<{ nome: string; perfil: string; status: StatusAtendente }>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const clinicaId = sessao.clinicaId ?? (await getClinicaId());
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  // Toda alteração (nome, status ou perfil) exige poder administrar o perfil
  // ATUAL do alvo — sem isso, mudar só o status contornaria a hierarquia
  // (ex.: bloquear uma Dona sem nunca poder criar uma).
  const alvo = await buscarAtendentePorId(clinicaId, id);
  if (!alvo) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!podeAtribuirPerfil(sessao.perfil, alvo.perfil)) {
    return NextResponse.json({ ok: false, error: "perfil_nao_permitido" }, { status: 403 });
  }

  // Mudança de perfil: além do alvo atual, o ator precisa poder atribuir o de destino.
  if (body.perfil !== undefined && !podeAtribuirPerfil(sessao.perfil, body.perfil as Perfil)) {
    return NextResponse.json({ ok: false, error: "perfil_nao_permitido" }, { status: 403 });
  }

  const resultado = await atualizarAtendente(clinicaId, id, body as never, sessao.atendenteId);
  if (!resultado.ok) return NextResponse.json(resultado, { status: resultado.error === "not_found" ? 404 : 400 });

  return NextResponse.json(resultado);
}
