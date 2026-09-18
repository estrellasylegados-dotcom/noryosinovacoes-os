import { getSupabaseServerClient } from "@/lib/supabase";
import { buscarConfigReputacao } from "@/lib/reputacao-config";
import { emitirEventoAutomacao } from "@/lib/fluxo-eventos-internos";

export type ResultadoSolicitarAvaliacao =
  | { ok: true }
  | { ok: false; error: "paciente_nao_encontrado" | "modulo_desativado" | "link_ausente" | "fluxo_nao_configurado" | "ja_em_andamento" | "erro" };

/**
 * Fase 5 — ação manual ("⭐ Solicitar avaliação Google" na ficha do
 * paciente). NÃO manda mensagem direto: só emite o evento interno
 * `solicitacao_avaliacao_google`, que o motor de Fluxo entrega pro Fluxo de
 * Reputação que o admin desenhou e ativou (mesmo caminho de qualquer outro
 * gatilho interno — ver fluxo-eventos-internos.ts). `referenciaId` é gerado
 * aqui a cada chamada; a proteção real contra duplo-clique é o botão se
 * desabilitar durante o request (mesmo padrão de PacienteDataNascimento.tsx)
 * — a dedupe do motor (`tipo:pacienteId:referenciaId`) é quem garante que,
 * se essa mesma referência algum dia se repetir (ex.: reentrega/retry HTTP
 * de verdade com o mesmo id), não vira uma 2ª execução.
 */
export async function solicitarAvaliacaoGoogle(clinicaId: string, pacienteId: string): Promise<ResultadoSolicitarAvaliacao> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "erro" };

  const { data: paciente } = await supabase.from("pacientes").select("id").eq("id", pacienteId).eq("clinica_id", clinicaId).maybeSingle();
  if (!paciente) return { ok: false, error: "paciente_nao_encontrado" };

  const config = await buscarConfigReputacao(clinicaId);
  if (!config.ativo) return { ok: false, error: "modulo_desativado" };
  if (!config.googleReviewUrl) return { ok: false, error: "link_ausente" };

  // `metadata` de emitirEventoAutomacao não é persistido hoje (Fase 3 nunca
  // implementou isso, ver fluxo-eventos-internos.ts) — não passar aqui pra
  // não sugerir um rastro que não existe. A origem "manual" já fica
  // implícita: é a única forma de emitir este evento por enquanto.
  const referenciaId = crypto.randomUUID();
  const resultado = await emitirEventoAutomacao({
    clinicaId,
    pacienteId,
    tipo: "solicitacao_avaliacao_google",
    referenciaId,
  });

  switch (resultado.resultado) {
    case "execucao_iniciada":
      return { ok: true };
    case "idempotencia_existente":
      return { ok: false, error: "ja_em_andamento" };
    case "fluxo_nao_encontrado":
    case "fluxo_inativo":
      return { ok: false, error: "fluxo_nao_configurado" };
    default:
      return { ok: false, error: "erro" };
  }
}
