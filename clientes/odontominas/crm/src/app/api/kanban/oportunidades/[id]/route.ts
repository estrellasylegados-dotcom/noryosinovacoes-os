import { NextResponse } from "next/server";
import { atualizarInteresse, buscarDetalheOportunidade, definirResponsavel } from "@/lib/kanban";
import { autorizarKanban, lerJson } from "@/lib/kanban-http";
import { statusHttpKanban } from "@/lib/kanban-regras";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const a = await autorizarKanban("kanban.visualizar");
  if ("erro" in a) return a.erro;
  const { id } = await context.params;

  const r = await buscarDetalheOportunidade(a.clinicaId, a.ator, id);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: statusHttpKanban(r.error) });
  return NextResponse.json({ ok: true, ...r.detalhe });
}

/**
 * PATCH só pra campos NÃO sensíveis: interesse e responsavelId (com
 * responsavelEsperadoId = quem o usuário viu, concorrência otimista).
 * Estágio, perdido e convertido têm ações explícitas (/mover, /perder, /converter).
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const a = await autorizarKanban("kanban.mover");
  if ("erro" in a) return a.erro;
  const { id } = await context.params;

  const body = await lerJson<{ interesse?: string | null; responsavelId?: string | null; responsavelEsperadoId?: string | null; estagioId?: unknown }>(request);
  if (!body || body.estagioId !== undefined) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  if (body.interesse !== undefined) {
    const r = await atualizarInteresse(a.clinicaId, a.ator, id, body.interesse);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: statusHttpKanban(r.error) });
  }
  if (body.responsavelId !== undefined) {
    const r = await definirResponsavel(a.clinicaId, a.ator, id, body.responsavelEsperadoId ?? null, body.responsavelId);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: statusHttpKanban(r.error) });
  }
  return NextResponse.json({ ok: true });
}
