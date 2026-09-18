import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Fase 5 — 1 linha por clínica (mesmo desenho de `clinicas`; não existe
 * tabela de settings genérica no projeto, ver migration v24). Guarda só o
 * que é nível-clínica: URL do Google, tracking, delay pra automação futura.
 * A MENSAGEM não mora aqui — ela é o texto do nó "mensagem" do Fluxo de
 * Reputação que o admin desenha no editor (mesmo padrão do NPS), resolvido
 * por resolverVariaveisFluxo. Duplicar um campo de template aqui criaria 2
 * fontes de verdade pro mesmo texto.
 */
export type ReputacaoConfig = {
  clinicaId: string;
  ativo: boolean;
  googleReviewUrl: string | null;
  rastrearCliques: boolean;
  delayHorasPadrao: number | null;
  automacaoAtendimentoConcluidoAtiva: boolean;
};

function linhaParaConfig(clinicaId: string, linha: Record<string, unknown> | null): ReputacaoConfig {
  if (!linha) {
    return {
      clinicaId,
      ativo: false,
      googleReviewUrl: null,
      rastrearCliques: true,
      delayHorasPadrao: null,
      automacaoAtendimentoConcluidoAtiva: false,
    };
  }
  return {
    clinicaId,
    ativo: Boolean(linha.ativo),
    googleReviewUrl: (linha.google_review_url as string | null) ?? null,
    rastrearCliques: Boolean(linha.rastrear_cliques),
    delayHorasPadrao: (linha.delay_horas_padrao as number | null) ?? null,
    automacaoAtendimentoConcluidoAtiva: Boolean(linha.automacao_atendimento_concluido_ativa),
  };
}

/** Sem linha ainda = módulo nunca configurado — devolve os defaults (inativo), nunca null. */
export async function buscarConfigReputacao(clinicaId: string): Promise<ReputacaoConfig> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return linhaParaConfig(clinicaId, null);

  const { data } = await supabase.from("reputacao_config").select("*").eq("clinica_id", clinicaId).maybeSingle();
  return linhaParaConfig(clinicaId, data ?? null);
}

function urlGoogleValida(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export type SalvarConfigReputacaoInput = {
  ativo: boolean;
  googleReviewUrl: string | null;
  rastrearCliques: boolean;
  delayHorasPadrao: number | null;
  automacaoAtendimentoConcluidoAtiva: boolean;
};

/**
 * `automacaoAtendimentoConcluidoAtiva` fica sempre gravado como veio, mas
 * hoje não tem efeito nenhum: nenhum código chama `emitirEventoAutomacao`
 * com esse gatilho a partir de um evento clínico real (ver
 * src/lib/fluxo-eventos-internos.ts) — o campo só existe pra não perder a
 * intenção do admin quando essa origem existir.
 */
export async function salvarConfigReputacao(
  clinicaId: string,
  input: SalvarConfigReputacaoInput
): Promise<{ ok: boolean; error?: string }> {
  const urlLimpa = input.googleReviewUrl?.trim() || null;
  if (input.ativo && !urlLimpa) return { ok: false, error: "url_ausente" };
  if (urlLimpa && !urlGoogleValida(urlLimpa)) return { ok: false, error: "url_invalida" };
  if (input.delayHorasPadrao !== null && (!Number.isInteger(input.delayHorasPadrao) || input.delayHorasPadrao < 0)) {
    return { ok: false, error: "delay_invalido" };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { error } = await supabase.from("reputacao_config").upsert(
    {
      clinica_id: clinicaId,
      ativo: input.ativo,
      google_review_url: urlLimpa,
      rastrear_cliques: input.rastrearCliques,
      delay_horas_padrao: input.delayHorasPadrao,
      automacao_atendimento_concluido_ativa: input.automacaoAtendimentoConcluidoAtiva,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinica_id" }
  );
  if (error) {
    console.error("[reputacao-config] salvar_failed", JSON.stringify({ clinicaId, code: error.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }
  return { ok: true };
}
