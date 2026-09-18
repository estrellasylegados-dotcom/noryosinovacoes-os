import { NextResponse } from "next/server";
import { getSessaoAtual, type SessaoAtual } from "@/lib/sessao-servidor";
import type { Permissao } from "@/lib/permissoes";

/**
 * Compatibilidade explícita, não descuido: dezenas de telas/rotas (Agentes,
 * Campanhas, Disparos, Fluxos, Conexão, Reputação, ControleODONTO, Resumo)
 * usavam `papel === "admin"` como gate único, e aplicar o catálogo granular
 * (seção 12 do pedido) em todas elas de uma vez está fora do escopo desta
 * fase — que mira Chat ao Vivo/SLA/Horário/Notas Internas/Equipe (seções
 * 48-51). `dona` e `noryos_admin` são exatamente quem herdava "admin" antes
 * desta fase, então isto preserva 100% do comportamento atual (sem
 * regressão) até cada uma dessas telas ganhar sua própria permissão
 * granular numa fase seguinte.
 */
export function isAdminEquivalente(sessao: SessaoAtual | null): sessao is SessaoAtual {
  return sessao?.perfil === "dona" || sessao?.perfil === "noryos_admin";
}

/**
 * Ponto único de decisão "essa pessoa pode fazer X" (seção 13/55 do pedido)
 * — substitui os `papel === "admin"` espalhados por rota. Backend é
 * autoridade (seção 14): frontend esconder botão nunca é o gate real.
 */
export function can(sessao: SessaoAtual | null, permissao: Permissao): boolean {
  return sessao?.permissoes.has(permissao) ?? false;
}

export type ResultadoAutorizacao = { sessao: SessaoAtual } | { erro: NextResponse };

/** Pra rotas de API: busca a sessão fresca do banco e já monta 401/403 quando não autorizado. Uso: `const r = await requirePermission("sla.configurar"); if ("erro" in r) return r.erro;` */
export async function requirePermission(permissao: Permissao): Promise<ResultadoAutorizacao> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { erro: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  if (!can(sessao, permissao)) return { erro: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  return { sessao };
}

/** Só exige sessão válida, sem checar permissão específica (ex.: uma tela que qualquer perfil logado acessa, cada seção dela checando a própria permissão). */
export async function requireSessao(): Promise<ResultadoAutorizacao> {
  const sessao = await getSessaoAtual();
  if (!sessao) return { erro: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  return { sessao };
}
