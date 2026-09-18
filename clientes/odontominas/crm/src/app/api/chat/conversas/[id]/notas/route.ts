import { NextResponse } from "next/server";
import { requireSessao } from "@/lib/autorizacao";
import { buscarNotasInternas, criarNotaInterna } from "@/lib/notas-internas";
import { getClinicaId } from "@/lib/clinica";
import { requirePermission } from "@/lib/autorizacao";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authSessao = await requireSessao();
  if ("erro" in authSessao) return authSessao.erro;
  const { id } = await context.params;

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const notas = await buscarNotasInternas(clinicaId, id);
  if (notas === null) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  return NextResponse.json({ ok: true, notas });
}

/** Autoria vem da sessão (nunca do body) — não dá pra assinar nota em nome de outro atendente. `conversas.notas_internas` (seção 50 do pedido) — todos os perfis operacionais têm por padrão, mas fica explícito e customizável pela Dona. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("conversas.notas_internas");
  if ("erro" in auth) return auth.erro;
  const { sessao } = auth;

  const { id } = await context.params;

  let body: { texto?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const resultado = await criarNotaInterna(clinicaId, id, sessao.atendenteId, body.texto ?? "");
  if (!resultado.ok) {
    const httpStatus = resultado.error === "not_found" ? 404 : resultado.error?.startsWith("texto") ? 400 : 503;
    return NextResponse.json(resultado, { status: httpStatus });
  }

  return NextResponse.json(resultado, { status: 201 });
}
