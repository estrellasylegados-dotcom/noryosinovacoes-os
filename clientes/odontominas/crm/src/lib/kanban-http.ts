import { NextResponse } from "next/server";
import { getClinicaId } from "@/lib/clinica";
import { atorDaSessao, requirePermission } from "@/lib/autorizacao";
import type { AtorConversa } from "@/lib/atribuicao";
import type { Permissao } from "@/lib/permissoes";
import { statusHttpKanban } from "@/lib/kanban-regras";
import type { ResultadoMover } from "@/lib/kanban";

/** Cola comum das rotas /api/kanban/*: sessão fresca + permissão + clínica (backend é a autoridade). */
export async function autorizarKanban(permissao: Permissao): Promise<{ clinicaId: string; ator: AtorConversa } | { erro: NextResponse }> {
  const auth = await requirePermission(permissao);
  if ("erro" in auth) return auth;
  const clinicaId = await getClinicaId();
  if (!auth.sessao.clinicaId) return { erro: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  if (!clinicaId) return { erro: NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 }) };
  // conta de outra clínica nunca enxerga o board desta.
  if (auth.sessao.clinicaId !== clinicaId) return { erro: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  return { clinicaId, ator: atorDaSessao(auth.sessao) };
}

export async function lerJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/** 409 traz versaoAtual/estagioAtual pra UI recarregar o card e avisar "atualizado por outro usuário". */
export function respostaMover(r: ResultadoMover): NextResponse {
  if (r.ok) return NextResponse.json(r);
  return NextResponse.json({ ok: false, error: r.error, versaoAtual: r.versaoAtual ?? null, estagioAtual: r.estagioAtual ?? null }, { status: statusHttpKanban(r.error) });
}
