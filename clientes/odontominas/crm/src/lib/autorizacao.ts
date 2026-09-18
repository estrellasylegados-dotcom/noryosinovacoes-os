import { NextResponse } from "next/server";
import { getSessaoAtual, type SessaoAtual } from "@/lib/sessao-servidor";
import type { Permissao } from "@/lib/permissoes";
import type { AtorConversa } from "@/lib/atribuicao";

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

/** Sessão → quem age numa conversa (caixa compartilhada, src/lib/atribuicao.ts). */
export function atorDaSessao(sessao: SessaoAtual): AtorConversa {
  return { atendenteId: sessao.atendenteId, perfil: sessao.perfil, permissoes: sessao.permissoes };
}

/** Status HTTP de um erro de atribuição/envio — 409 = conflito controlado (a UI mostra quem assumiu). */
export function statusHttpErroConversa(error: string | undefined): number {
  switch (error) {
    case "unauthorized":
      return 401;
    case "forbidden":
    case "nao_e_responsavel":
    case "conversa_finalizada":
      return 403;
    case "not_found":
      return 404;
    case "ja_assumida":
    case "conflito":
    case "canal_pausado":
    case "canal_indisponivel":
    case "canal_nao_encontrado":
    case "provider_nao_suportado":
      return 409;
    case "destino_invalido":
    case "destino_sem_permissao":
    case "texto_vazio":
    case "telefone_invalido":
      return 400;
    default:
      return 503;
  }
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
