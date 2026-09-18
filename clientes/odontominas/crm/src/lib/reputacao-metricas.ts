import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Fase 5 — mesmo desenho de src/lib/nps.ts: núcleo puro testável +
 * wrapper de I/O. `enviadas` exclui `falhou` do denominador de propósito
 * (item 23 da visão original) — taxa de clique é sobre o que de fato saiu,
 * não sobre tudo que foi criado.
 */
export type PainelReputacao = {
  total: number;
  enviadas: number;
  clicadas: number;
  falhas: number;
  taxaClique: number | null;
};

export function calcularPainelReputacao(pesquisas: { status: string }[]): PainelReputacao {
  const total = pesquisas.length;
  const falhas = pesquisas.filter((p) => p.status === "falhou").length;
  const clicadas = pesquisas.filter((p) => p.status === "clicada").length;
  const enviadas = total - falhas;

  return {
    total,
    enviadas,
    clicadas,
    falhas,
    taxaClique: enviadas > 0 ? clicadas / enviadas : null,
  };
}

export async function buscarPainelReputacao(clinicaId: string, periodo: { inicio: Date; fim: Date }): Promise<PainelReputacao> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return calcularPainelReputacao([]);

  const { data } = await supabase
    .from("pesquisas")
    .select("status")
    .eq("clinica_id", clinicaId)
    .eq("tipo", "avaliacao_google")
    .gte("enviado_em", periodo.inicio.toISOString())
    .lte("enviado_em", periodo.fim.toISOString());

  return calcularPainelReputacao(data ?? []);
}

export type SolicitacaoReputacao = {
  id: string;
  pacienteNome: string | null;
  enviadoEm: string | null;
  status: string;
  clicadoEm: string | null;
};

export const LABEL_STATUS_REPUTACAO: Record<string, string> = {
  enviada: "Enviada",
  clicada: "Clicada",
  falhou: "Falhou",
  pendente: "Pendente",
  expirada: "Expirada",
  cancelada: "Cancelada",
};

/**
 * `origem` não é campo de listagem hoje: enquanto a única forma de emitir
 * `solicitacao_avaliacao_google` for a ação manual (ver
 * reputacao-solicitacao.ts), toda linha É "Manual" — guardar uma coluna só
 * pra repetir a mesma string seria dado sem uso real. Quando existir uma 2ª
 * origem (evento `atendimento_concluido`), aí sim vale a pena.
 */
export const ORIGEM_REPUTACAO_ATUAL = "Manual";

/** Busca em 2 passos (mesmo estilo do resto do projeto) — pesquisas do período, depois o nome de cada paciente. */
export async function listarSolicitacoesReputacao(
  clinicaId: string,
  periodo: { inicio: Date; fim: Date },
  status?: string
): Promise<SolicitacaoReputacao[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("pesquisas")
    .select("id, paciente_id, enviado_em, status, clicado_em")
    .eq("clinica_id", clinicaId)
    .eq("tipo", "avaliacao_google")
    .gte("enviado_em", periodo.inicio.toISOString())
    .lte("enviado_em", periodo.fim.toISOString())
    .order("enviado_em", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data: pesquisas } = await query;
  if (!pesquisas || pesquisas.length === 0) return [];

  const pacienteIds = [...new Set(pesquisas.map((p) => p.paciente_id as string))];
  const { data: pacientes } = await supabase.from("pacientes").select("id, nome").in("id", pacienteIds);
  const nomePorId = new Map((pacientes ?? []).map((p) => [p.id as string, (p.nome as string | null) ?? null]));

  return pesquisas.map((p) => ({
    id: p.id as string,
    pacienteNome: nomePorId.get(p.paciente_id as string) ?? null,
    enviadoEm: (p.enviado_em as string | null) ?? null,
    status: p.status as string,
    clicadoEm: (p.clicado_em as string | null) ?? null,
  }));
}
