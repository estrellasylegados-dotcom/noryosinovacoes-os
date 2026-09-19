import { NextResponse } from "next/server";
import { getClinicaId } from "@/lib/clinica";
import { requirePermission } from "@/lib/autorizacao";
import { PERFIS_PLATAFORMA, type Permissao } from "@/lib/permissoes";
import { executarAcaoAlerta, type AtorAcaoAlerta, type ErroAlerta } from "@/lib/alertas";
import type { AcaoAlerta } from "@/lib/alertas-tipos";
import type { SessaoAtual } from "@/lib/sessao-servidor";

/** Cola comum das rotas /api/alertas/*: sessão fresca + permissão + clínica. Backend é a autoridade. */

export type ContextoAlertas = { clinicaId: string; sessao: SessaoAtual; ator: AtorAcaoAlerta };

/**
 * Clínica de quem consulta: conta de clínica só enxerga a PRÓPRIA (nunca a de
 * outra, mesmo pedindo id). Conta de plataforma (Suporte/Admin) não pertence a
 * nenhuma clínica — atua sobre a clínica desta instalação, limitada às
 * permissões do perfil (alertas técnicos exigem `alertas.tecnicos`).
 */
export function clinicaDaSessao(sessao: Pick<SessaoAtual, "perfil" | "clinicaId">, clinicaDaInstancia: string | null): string | null {
  if (!clinicaDaInstancia) return null;
  if (PERFIS_PLATAFORMA.has(sessao.perfil)) return clinicaDaInstancia;
  return sessao.clinicaId === clinicaDaInstancia ? clinicaDaInstancia : null;
}

export function atorAlerta(sessao: SessaoAtual): AtorAcaoAlerta {
  return { atendenteId: sessao.atendenteId, perfil: sessao.perfil, permissoes: sessao.permissoes };
}

export async function autorizarAlertas(permissao: Permissao): Promise<ContextoAlertas | { erro: NextResponse }> {
  const auth = await requirePermission(permissao);
  if ("erro" in auth) return auth;
  const clinicaId = clinicaDaSessao(auth.sessao, await getClinicaId());
  if (!clinicaId) return { erro: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  return { clinicaId, sessao: auth.sessao, ator: atorAlerta(auth.sessao) };
}

export function statusHttpAlerta(error: ErroAlerta | string | undefined): number {
  switch (error) {
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "transicao_invalida":
      return 409;
    case "motivo_muito_longo":
    case "invalid_body":
    case "tipos_invalidos":
    case "sem_responsavel_invalido":
    case "carencia_invalida":
    case "kanban_invalido":
    case "estagio_invalido":
      return 400;
    default:
      return 503;
  }
}

const PERMISSAO_ACAO: Record<AcaoAlerta, Permissao> = { assumir: "alertas.assumir", resolver: "alertas.resolver", ignorar: "alertas.ignorar" };

/** Handler único das 3 ações explícitas (POST /api/alertas/:id/{assumir|resolver|ignorar}). */
export async function tratarAcaoAlerta(request: Request, context: { params: Promise<{ id: string }> }, acao: AcaoAlerta): Promise<NextResponse> {
  const a = await autorizarAlertas(PERMISSAO_ACAO[acao]);
  if ("erro" in a) return a.erro;
  const { id } = await context.params;

  let motivo: string | null = null;
  if (acao === "ignorar") {
    const body = (await request.json().catch(() => null)) as { motivo?: unknown } | null;
    if (body?.motivo !== undefined && body.motivo !== null && typeof body.motivo !== "string") return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    motivo = (body?.motivo as string | null | undefined) ?? null;
  }

  const r = await executarAcaoAlerta(a.clinicaId, id, acao, a.ator, { motivo });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: statusHttpAlerta(r.error) });
  return NextResponse.json({ ok: true, status: r.alerta.status });
}
