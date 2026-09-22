import { getSupabaseServerClient } from "@/lib/supabase";
import { buscarConfigReputacao } from "@/lib/reputacao-config";
import { buscarConfiguracaoHorario, calcularProximoHorario } from "@/lib/horario-atendimento";
import { emitirEventoAutomacao } from "@/lib/fluxo-eventos-internos";
import { registrarEvento } from "@/lib/auditoria";

const ETIQUETA_FINALIZADO = "atendimento finalizado";
export function ehEtiquetaAtendimentoFinalizado(nome: string): boolean {
  return nome.trim().toLocaleLowerCase("pt-BR") === ETIQUETA_FINALIZADO;
}

/** Única ponte atual para o evento clínico; uma integração futura só troca `origem`/referência. */
export async function registrarAtendimentoFinalizadoPorEtiqueta(clinicaId: string, conversaId: string, etiquetaId: string): Promise<void> {
  const db = getSupabaseServerClient();
  if (!db) return;
  const { data: conversa } = await db.from("conversas").select("paciente_id").eq("id", conversaId).eq("clinica_id", clinicaId).maybeSingle();
  const pacienteId = conversa?.paciente_id as string | null;
  if (!pacienteId) return;
  const referencia = `etiqueta:${conversaId}:${etiquetaId}`;
  const { data: atendimento, error } = await db.from("reputacao_atendimentos").insert({
    clinica_id: clinicaId, paciente_id: pacienteId, conversa_id: conversaId, origem: "etiqueta", origem_referencia: referencia,
  }).select("id").maybeSingle();
  if (error?.code === "23505" || !atendimento) return; // duplicata/retry: a ocorrência já foi tratada
  if (error) return;

  await registrarEvento({ clinicaId, evento: "REPUTACAO_ATENDIMENTO_FINALIZADO", alvoId: atendimento.id, detalhes: { origem: "etiqueta" } });
  const config = await buscarConfigReputacao(clinicaId);
  const horario = await buscarConfiguracaoHorario(clinicaId);
  if (!horario) return; // sem horário oficial, não assume 24x7
  if (config.pesquisaAtiva) {
    const base = new Date(Date.now() + (config.pesquisaDelayMinutos ?? 30) * 60_000);
    const agendado = calcularProximoHorario(horario, base);
    if (agendado) await emitirEventoAutomacao({
      clinicaId, pacienteId, tipo: "atendimento_concluido", referenciaId: atendimento.id as string,
      metadata: { atendimento_id: atendimento.id as string }, aguardarAte: agendado.toISOString(),
    });
  }
  // Google é agenda separada e independente da resposta da pesquisa. O worker
  // de Fluxos existente tenta quando a conversa estiver livre; nunca há gating.
  if (config.googleAtivo && config.googleReviewUrl) {
    const googleBase = new Date(Date.now() + (config.googleDelayMinutos ?? 120) * 60_000);
    const googleDevido = calcularProximoHorario(horario, googleBase);
    if (googleDevido) await db.from("reputacao_agendamentos").upsert({ clinica_id: clinicaId, paciente_id: pacienteId, atendimento_id: atendimento.id, tipo: "google", devido_em: googleDevido.toISOString() }, { onConflict: "atendimento_id,tipo", ignoreDuplicates: true });
  }
}
