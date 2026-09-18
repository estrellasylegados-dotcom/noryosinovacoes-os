import { NextResponse } from "next/server";
import { getSessaoAtual, type SessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { buscarCanalPorId, type Canal } from "@/lib/canais";
import type { Permissao } from "@/lib/permissoes";

/**
 * Autorização comum das rotas de /api/canais: sessão válida + UMA das
 * permissões pedidas + clínica resolvida no servidor. Conta de clínica só
 * mexe nos canais da própria clínica (Noryos Admin/Suporte têm clinica_id
 * null — plataforma — e operam na clínica deste deploy, sempre auditado).
 * Nunca aceita clinicaId/canalId vindo do cliente como autoridade: o canal
 * do path é relido AQUI, já filtrado pela clínica.
 */
export type ContextoCanais = { sessao: SessaoAtual; clinicaId: string };

export async function autorizarCanais(
  permissoes: Permissao | Permissao[]
): Promise<ContextoCanais | { erro: NextResponse }> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { erro: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };

  const lista = Array.isArray(permissoes) ? permissoes : [permissoes];
  if (!lista.some((p) => sessao.permissoes.has(p))) {
    return { erro: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) return { erro: NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 }) };
  if (sessao.clinicaId && sessao.clinicaId !== clinicaId) {
    return { erro: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }
  return { sessao, clinicaId };
}

export async function carregarCanalDaRota(
  contexto: ContextoCanais,
  params: Promise<{ id: string }>
): Promise<Canal | { erro: NextResponse }> {
  const { id } = await params;
  const canal = await buscarCanalPorId(contexto.clinicaId, id);
  if (!canal) return { erro: NextResponse.json({ ok: false, error: "not_found" }, { status: 404 }) };
  return canal;
}

export function statusHttpErroCanal(error: string | undefined): number {
  switch (error) {
    case "not_found":
      return 404;
    case "nome_vazio":
    case "nome_muito_longo":
    case "instancia_invalida":
    case "credencial_ref_invalida":
    case "canal_invalido":
      return 400;
    case "instancia_ja_cadastrada":
    case "canal_principal_nao_pode_pausar":
      return 409;
    default:
      return 503;
  }
}
