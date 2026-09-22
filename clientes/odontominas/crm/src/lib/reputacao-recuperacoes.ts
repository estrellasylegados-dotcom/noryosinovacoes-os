import { getSupabaseServerClient } from "@/lib/supabase";
import { registrarEvento } from "@/lib/auditoria";

export const STATUS_RECUPERACAO = ["aberto", "em_tratativa", "resolvido"] as const;
export const MOTIVOS_RECUPERACAO = ["atendimento", "tempo_espera", "comunicacao", "procedimento", "agendamento", "cobranca", "estrutura", "outro"] as const;
export type StatusRecuperacao = (typeof STATUS_RECUPERACAO)[number];
export type MotivoRecuperacao = (typeof MOTIVOS_RECUPERACAO)[number];
export function isStatusRecuperacao(v: unknown): v is StatusRecuperacao { return typeof v === "string" && (STATUS_RECUPERACAO as readonly string[]).includes(v); }
export function isMotivoRecuperacao(v: unknown): v is MotivoRecuperacao { return typeof v === "string" && (MOTIVOS_RECUPERACAO as readonly string[]).includes(v); }

export type RecuperacaoLista = { id: string; pacienteNome: string | null; conversaId: string; respostaOriginal: string; status: StatusRecuperacao; motivo: MotivoRecuperacao | null; responsavelId: string | null; abertoEm: string; primeiraTratativaEm: string | null; resolvidoEm: string | null; observacoesInternas: string | null; solucao: string | null };
export async function listarRecuperacoes(clinicaId: string, escopo?: { atendenteId: string; equipe: boolean }): Promise<RecuperacaoLista[]> {
  const db = getSupabaseServerClient(); if (!db) return [];
  let query = db.from("recuperacao_experiencias").select("id,paciente_id,conversa_id,resposta_original,status,motivo,responsavel_id,aberto_em,primeira_tratativa_em,resolvido_em,observacoes_internas,solucao").eq("clinica_id", clinicaId).order("aberto_em", { ascending: false });
  if (escopo && !escopo.equipe) query = query.or(`responsavel_id.is.null,responsavel_id.eq.${escopo.atendenteId}`);
  const { data } = await query;
  const ids = [...new Set((data ?? []).map((r) => r.paciente_id as string))];
  const { data: pacientes } = ids.length ? await db.from("pacientes").select("id,nome").in("id", ids) : { data: [] as { id: string; nome: string | null }[] };
  const nomes = new Map((pacientes ?? []).map((p) => [p.id as string, p.nome as string | null]));
  return (data ?? []).map((r) => ({ id: r.id as string, pacienteNome: nomes.get(r.paciente_id as string) ?? null, conversaId: r.conversa_id as string, respostaOriginal: r.resposta_original as string, status: r.status as StatusRecuperacao, motivo: r.motivo as MotivoRecuperacao | null, responsavelId: r.responsavel_id as string | null, abertoEm: r.aberto_em as string, primeiraTratativaEm: r.primeira_tratativa_em as string | null, resolvidoEm: r.resolvido_em as string | null, observacoesInternas: r.observacoes_internas as string | null, solucao: r.solucao as string | null }));
}

export async function atualizarRecuperacao(clinicaId: string, id: string, atorId: string, equipe: boolean, input: { status?: StatusRecuperacao; motivo?: MotivoRecuperacao | null; observacoesInternas?: string; solucao?: string }): Promise<{ ok: boolean; error?: string }> {
  const db = getSupabaseServerClient(); if (!db) return { ok: false, error: "backend_unavailable" };
  if (input.status !== undefined && !isStatusRecuperacao(input.status)) return { ok: false, error: "status_invalido" };
  if (input.motivo !== undefined && input.motivo !== null && !isMotivoRecuperacao(input.motivo)) return { ok: false, error: "motivo_invalido" };
  const { data: atual } = await db.from("recuperacao_experiencias").select("status,primeira_tratativa_em,responsavel_id").eq("id", id).eq("clinica_id", clinicaId).maybeSingle();
  if (!atual) return { ok: false, error: "not_found" };
  if (!equipe && atual.responsavel_id && atual.responsavel_id !== atorId) return { ok: false, error: "not_found" };
  const agora = new Date().toISOString(); const patch: Record<string, unknown> = { updated_at: agora };
  if (!atual.responsavel_id) patch.responsavel_id = atorId;
  if (input.status) { patch.status = input.status; if (input.status === "em_tratativa" && !atual.primeira_tratativa_em) patch.primeira_tratativa_em = agora; if (input.status === "resolvido") { if (!input.solucao?.trim()) return { ok: false, error: "solucao_obrigatoria" }; patch.resolvido_em = agora; } }
  if (input.motivo !== undefined) patch.motivo = input.motivo;
  if (input.observacoesInternas !== undefined) patch.observacoes_internas = input.observacoesInternas.trim().slice(0, 5000) || null;
  if (input.solucao !== undefined) patch.solucao = input.solucao.trim().slice(0, 5000) || null;
  const { error } = await db.from("recuperacao_experiencias").update(patch).eq("id", id).eq("clinica_id", clinicaId);
  if (error) return { ok: false, error: "persist_failed" };
  await registrarEvento({ clinicaId, atorId, evento: "REPUTACAO_RECUPERACAO_ATUALIZADA", alvoId: id, detalhes: { status: input.status ?? null, motivo: input.motivo ?? null } });
  return { ok: true };
}
