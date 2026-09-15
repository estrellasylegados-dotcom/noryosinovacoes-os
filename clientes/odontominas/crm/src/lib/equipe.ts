import { getSupabaseServerClient } from "@/lib/supabase";
import { listarAtendentes, type Atendente } from "@/lib/atendentes";
import { listarConversas } from "@/lib/conversas";
import { inicioDoDiaBrasilia } from "@/lib/tempo";

/**
 * Estatística de atendimento por secretária/atendente (visão Equipe, só
 * admin) — a dona da clínica enxergar quem atendeu quanto é o que dá peso
 * de gestão real a este V1, não só um painel bonito.
 *
 * "Conversa atendida" = teve ao menos 1 troca de status manual (dropdown do
 * painel) feita por essa pessoa — é o rastro que existe hoje; o webhook
 * automático não tem como saber qual secretária digitou a resposta no
 * WhatsApp, então essas transições ficam de fora da contagem por pessoa
 * (contam só no funil geral, ver src/lib/resumo.ts).
 */
export type StatAtendente = Atendente & {
  conversasAtendidas: number;
  atendimentosHoje: number;
  /** Média só entre conversas em que esta pessoa foi quem marcou "respondido" (mesmo critério do resumo geral). */
  tempoMedioRespostaMs: number | null;
  ultimaAtividade: string | null;
};

function vazio(a: Atendente): StatAtendente {
  return { ...a, conversasAtendidas: 0, atendimentosHoje: 0, tempoMedioRespostaMs: null, ultimaAtividade: null };
}

export async function buscarStatsAtendentes(clinicaId: string): Promise<StatAtendente[]> {
  const [atendentes, conversas] = await Promise.all([listarAtendentes(clinicaId), listarConversas(clinicaId)]);
  if (atendentes.length === 0) return [];

  const supabase = getSupabaseServerClient();
  if (!supabase) return atendentes.map(vazio);

  const { data: eventos, error } = await supabase
    .from("eventos_funil")
    .select("conversa_id, atendente_id, created_at")
    .eq("clinica_id", clinicaId)
    .eq("motivo", "manual");

  if (error) return atendentes.map(vazio);

  const inicioHoje = inicioDoDiaBrasilia(new Date()).toISOString();

  const conversasPorAtendente = new Map<string, Set<string>>();
  const hojePorAtendente = new Map<string, Set<string>>();
  const ultimaPorAtendente = new Map<string, string>();

  for (const ev of eventos ?? []) {
    const atendenteId = ev.atendente_id as string | null;
    if (!atendenteId) continue;
    const conversaId = ev.conversa_id as string;
    const criadoEm = ev.created_at as string;

    if (!conversasPorAtendente.has(atendenteId)) conversasPorAtendente.set(atendenteId, new Set());
    conversasPorAtendente.get(atendenteId)!.add(conversaId);

    if (criadoEm >= inicioHoje) {
      if (!hojePorAtendente.has(atendenteId)) hojePorAtendente.set(atendenteId, new Set());
      hojePorAtendente.get(atendenteId)!.add(conversaId);
    }

    const atual = ultimaPorAtendente.get(atendenteId);
    if (!atual || criadoEm > atual) ultimaPorAtendente.set(atendenteId, criadoEm);
  }

  const temposPorAtendente = new Map<string, number[]>();
  for (const c of conversas) {
    if (!c.atendidoPorId || c.tempoPrimeiraRespostaMs === null) continue;
    if (c.status !== "respondido" && c.status !== "agendado") continue;
    if (!temposPorAtendente.has(c.atendidoPorId)) temposPorAtendente.set(c.atendidoPorId, []);
    temposPorAtendente.get(c.atendidoPorId)!.push(c.tempoPrimeiraRespostaMs);
  }

  return atendentes.map((a) => {
    const tempos = temposPorAtendente.get(a.id) ?? [];
    const tempoMedioRespostaMs =
      tempos.length > 0 ? Math.round(tempos.reduce((soma, v) => soma + v, 0) / tempos.length) : null;

    return {
      ...a,
      conversasAtendidas: conversasPorAtendente.get(a.id)?.size ?? 0,
      atendimentosHoje: hojePorAtendente.get(a.id)?.size ?? 0,
      tempoMedioRespostaMs,
      ultimaAtividade: ultimaPorAtendente.get(a.id) ?? null,
    };
  });
}
