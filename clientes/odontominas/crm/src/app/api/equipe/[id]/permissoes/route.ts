import { NextResponse } from "next/server";
import { definirPermissoesCustomizadas, buscarAtendentePorId } from "@/lib/atendentes";
import { getClinicaId } from "@/lib/clinica";
import { requirePermission } from "@/lib/autorizacao";
import { isPermissaoValida } from "@/lib/permissoes";

export const runtime = "nodejs";

/** Tela de permissões (seção 39 do pedido) — só quem tem `usuarios.gerenciar_permissoes` (Dona/Noryos Admin por padrão) chega aqui. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("usuarios.gerenciar_permissoes");
  if ("erro" in auth) return auth.erro;
  const { sessao } = auth;

  const { id } = await context.params;
  if (id === sessao.atendenteId) {
    return NextResponse.json({ ok: false, error: "nao_pode_editar_a_propria_conta" }, { status: 403 });
  }

  let body: { permissoes: string[] | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (body.permissoes !== null && (!Array.isArray(body.permissoes) || !body.permissoes.every(isPermissaoValida))) {
    return NextResponse.json({ ok: false, error: "permissoes_invalidas" }, { status: 400 });
  }

  const clinicaId = sessao.clinicaId ?? (await getClinicaId());
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const alvo = await buscarAtendentePorId(clinicaId, id);
  if (!alvo) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const resultado = await definirPermissoesCustomizadas(clinicaId, id, body.permissoes, sessao.atendenteId);
  if (!resultado.ok) return NextResponse.json(resultado, { status: 400 });

  return NextResponse.json(resultado);
}
