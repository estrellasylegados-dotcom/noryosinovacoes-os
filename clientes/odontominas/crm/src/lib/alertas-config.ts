import { getSupabaseServerClient } from "@/lib/supabase";
import { registrarEvento } from "@/lib/auditoria";
import { buscarSlaConfig, type SlaConfig } from "@/lib/sla";
import { inteiroEntre, isTipoAlerta, LIMITES_CONFIG, type TipoAlerta } from "@/lib/alertas-tipos";

/**
 * Configuração mínima dos alertas. O SLA NÃO é configurado aqui: a faixa de
 * atenção e os limites vivem em `sla_config` (tela SLA / Atendimento) e o
 * verificador só lê — nada de segunda fonte de verdade.
 *
 * Lista negra de tipos (`tipos_desabilitados`): um tipo novo nasce ligado,
 * sem migration. Tempo por etapa do Kanban = 1 regra por etapa, em minutos
 * (a tela converte de/para horas e dias).
 */

export type RegraKanban = { estagioId: string; estagioNome: string; pipelineNome: string; limiteMinutos: number | null; ativo: boolean };

export type AlertasConfig = {
  clinicaId: string;
  tiposDesabilitados: TipoAlerta[];
  semResponsavelMinutos: number;
  canalCarenciaMinutos: number;
  ultimaVerificacaoEm: string | null;
  ultimaVerificacaoDuracaoMs: number | null;
  kanbanRegras: RegraKanban[];
  sla: Pick<SlaConfig, "ativo" | "alertaPercentual" | "primeiraRespostaMinutos" | "respostaAtendimentoMinutos">;
};

export const PADROES = { semResponsavelMinutos: 10, canalCarenciaMinutos: 2 } as const;

/** Regras iniciais por NOME de etapa: "Novo" 30 min, "Follow-up" 3 dias. Editáveis na tela de configuração. */
export function limiteInicialDaEtapa(nome: string): number | null {
  const n = nome.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (n === "novo") return 30;
  if (n === "follow-up" || n === "followup") return 3 * 24 * 60;
  return null;
}

type EstagioAberto = { id: string; nome: string; pipelineNome: string };

async function estagiosAbertos(clinicaId: string): Promise<EstagioAberto[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("pipeline_estagios")
    .select("id, nome, ordem, pipelines(nome, padrao)")
    .eq("clinica_id", clinicaId)
    .eq("tipo", "open")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  return (data ?? []).map((e) => {
    const p = Array.isArray(e.pipelines) ? e.pipelines[0] : e.pipelines;
    return { id: e.id as string, nome: e.nome as string, pipelineNome: (p as { nome?: string } | null)?.nome ?? "Pipeline" };
  });
}

/**
 * Primeira vez da clínica: cria a linha de config e semeia as regras iniciais do
 * Kanban. Quem perde a corrida (23505) simplesmente não semeia — a outra chamada semeou.
 */
export async function garantirConfigInicial(clinicaId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { data: existente } = await supabase.from("alertas_config").select("clinica_id").eq("clinica_id", clinicaId).maybeSingle();
  if (existente) return;

  const { error } = await supabase.from("alertas_config").insert({ clinica_id: clinicaId });
  if (error) {
    if (error.code !== "23505") console.error("[alertas-config] semear_failed", JSON.stringify({ code: error.code ?? null }));
    return;
  }

  const linhas = (await estagiosAbertos(clinicaId))
    .map((e) => ({ estagio: e, limite: limiteInicialDaEtapa(e.nome) }))
    .filter((x): x is { estagio: EstagioAberto; limite: number } => x.limite !== null)
    .map((x) => ({ clinica_id: clinicaId, estagio_id: x.estagio.id, limite_minutos: x.limite }));
  if (linhas.length > 0) await supabase.from("alertas_kanban_regras").upsert(linhas, { onConflict: "estagio_id", ignoreDuplicates: true });
}

export type ConfigVerificador = {
  tiposDesabilitados: Set<string>;
  semResponsavelMinutos: number;
  canalCarenciaMinutos: number;
  regrasKanban: { id: string; estagioId: string; limiteMinutos: number }[];
};

/** Versão enxuta pro verificador (1 consulta por tabela, sem nomes de etapa). */
export async function buscarConfigVerificador(clinicaId: string): Promise<ConfigVerificador> {
  await garantirConfigInicial(clinicaId);
  const supabase = getSupabaseServerClient();
  const padrao: ConfigVerificador = { tiposDesabilitados: new Set(), semResponsavelMinutos: PADROES.semResponsavelMinutos, canalCarenciaMinutos: PADROES.canalCarenciaMinutos, regrasKanban: [] };
  if (!supabase) return padrao;

  const [{ data: cfg }, { data: regras }] = await Promise.all([
    supabase.from("alertas_config").select("tipos_desabilitados, sem_responsavel_minutos, canal_carencia_minutos").eq("clinica_id", clinicaId).maybeSingle(),
    supabase.from("alertas_kanban_regras").select("id, estagio_id, limite_minutos").eq("clinica_id", clinicaId).eq("ativo", true),
  ]);

  return {
    tiposDesabilitados: new Set((cfg?.tipos_desabilitados as string[] | null) ?? []),
    semResponsavelMinutos: (cfg?.sem_responsavel_minutos as number | null) ?? PADROES.semResponsavelMinutos,
    canalCarenciaMinutos: (cfg?.canal_carencia_minutos as number | null) ?? PADROES.canalCarenciaMinutos,
    regrasKanban: (regras ?? []).map((r) => ({ id: r.id as string, estagioId: r.estagio_id as string, limiteMinutos: r.limite_minutos as number })),
  };
}

/** Versão completa pra tela de configuração. */
export async function buscarConfigAlertas(clinicaId: string): Promise<AlertasConfig> {
  await garantirConfigInicial(clinicaId);
  const supabase = getSupabaseServerClient();
  const [cfg, regras, estagios, sla] = await Promise.all([
    supabase?.from("alertas_config").select("*").eq("clinica_id", clinicaId).maybeSingle(),
    supabase?.from("alertas_kanban_regras").select("estagio_id, limite_minutos, ativo").eq("clinica_id", clinicaId),
    estagiosAbertos(clinicaId),
    buscarSlaConfig(clinicaId),
  ]);

  const porEstagio = new Map((regras?.data ?? []).map((r) => [r.estagio_id as string, r]));
  const linha = cfg?.data ?? null;

  return {
    clinicaId,
    tiposDesabilitados: ((linha?.tipos_desabilitados as string[] | null) ?? []).filter(isTipoAlerta),
    semResponsavelMinutos: (linha?.sem_responsavel_minutos as number | null) ?? PADROES.semResponsavelMinutos,
    canalCarenciaMinutos: (linha?.canal_carencia_minutos as number | null) ?? PADROES.canalCarenciaMinutos,
    ultimaVerificacaoEm: (linha?.ultima_verificacao_em as string | null) ?? null,
    ultimaVerificacaoDuracaoMs: (linha?.ultima_verificacao_duracao_ms as number | null) ?? null,
    kanbanRegras: estagios.map((e) => {
      const r = porEstagio.get(e.id);
      return { estagioId: e.id, estagioNome: e.nome, pipelineNome: e.pipelineNome, limiteMinutos: (r?.limite_minutos as number | undefined) ?? null, ativo: r ? Boolean(r.ativo) : false };
    }),
    sla: { ativo: sla.ativo, alertaPercentual: sla.alertaPercentual, primeiraRespostaMinutos: sla.primeiraRespostaMinutos, respostaAtendimentoMinutos: sla.respostaAtendimentoMinutos },
  };
}

export type SalvarConfigInput = {
  tiposDesabilitados?: unknown;
  semResponsavelMinutos?: unknown;
  canalCarenciaMinutos?: unknown;
  /** limiteMinutos null = sem regra pra essa etapa. */
  kanbanRegras?: unknown;
};

export type ErroConfig = "backend_unavailable" | "tipos_invalidos" | "sem_responsavel_invalido" | "carencia_invalida" | "kanban_invalido" | "estagio_invalido" | "persist_failed";

export type RegraEntrada = { estagioId: string; limiteMinutos: number | null };

/** Validação pura (testável): devolve o payload limpo ou o erro. */
export function validarConfig(
  input: SalvarConfigInput
): { ok: true; tipos?: TipoAlerta[]; semResponsavel?: number; carencia?: number; regras?: RegraEntrada[] } | { ok: false; error: ErroConfig } {
  const saida: { tipos?: TipoAlerta[]; semResponsavel?: number; carencia?: number; regras?: RegraEntrada[] } = {};

  if (input.tiposDesabilitados !== undefined) {
    if (!Array.isArray(input.tiposDesabilitados) || !input.tiposDesabilitados.every(isTipoAlerta)) return { ok: false, error: "tipos_invalidos" };
    saida.tipos = [...new Set(input.tiposDesabilitados as TipoAlerta[])];
  }
  if (input.semResponsavelMinutos !== undefined) {
    const { min, max } = LIMITES_CONFIG.semResponsavelMinutos;
    if (!inteiroEntre(input.semResponsavelMinutos, min, max)) return { ok: false, error: "sem_responsavel_invalido" };
    saida.semResponsavel = input.semResponsavelMinutos;
  }
  if (input.canalCarenciaMinutos !== undefined) {
    const { min, max } = LIMITES_CONFIG.canalCarenciaMinutos;
    if (!inteiroEntre(input.canalCarenciaMinutos, min, max)) return { ok: false, error: "carencia_invalida" };
    saida.carencia = input.canalCarenciaMinutos;
  }
  if (input.kanbanRegras !== undefined) {
    if (!Array.isArray(input.kanbanRegras)) return { ok: false, error: "kanban_invalido" };
    const { min, max } = LIMITES_CONFIG.kanbanLimiteMinutos;
    const regras: RegraEntrada[] = [];
    for (const r of input.kanbanRegras as { estagioId?: unknown; limiteMinutos?: unknown }[]) {
      if (typeof r?.estagioId !== "string" || !r.estagioId) return { ok: false, error: "kanban_invalido" };
      if (r.limiteMinutos !== null && !inteiroEntre(r.limiteMinutos, min, max)) return { ok: false, error: "kanban_invalido" };
      regras.push({ estagioId: r.estagioId, limiteMinutos: r.limiteMinutos as number | null });
    }
    saida.regras = regras;
  }
  return { ok: true, ...saida };
}

export async function salvarConfigAlertas(
  clinicaId: string,
  input: SalvarConfigInput,
  ator: { atendenteId: string; perfil: string | null }
): Promise<{ ok: true } | { ok: false; error: ErroConfig }> {
  const v = validarConfig(input);
  if (!v.ok) return v;
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };
  await garantirConfigInicial(clinicaId);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (v.tipos) patch.tipos_desabilitados = v.tipos;
  if (v.semResponsavel !== undefined) patch.sem_responsavel_minutos = v.semResponsavel;
  if (v.carencia !== undefined) patch.canal_carencia_minutos = v.carencia;
  const { error } = await supabase.from("alertas_config").update(patch).eq("clinica_id", clinicaId);
  if (error) return { ok: false, error: "persist_failed" };

  if (v.regras) {
    // Etapa precisa ser desta clínica (nunca aceitar id de outra).
    const ids = v.regras.map((r) => r.estagioId);
    const { data: validos } = await supabase.from("pipeline_estagios").select("id").eq("clinica_id", clinicaId).in("id", ids);
    const setValidos = new Set((validos ?? []).map((e) => e.id as string));
    if (ids.some((id) => !setValidos.has(id))) return { ok: false, error: "estagio_invalido" };

    const agora = new Date().toISOString();
    const upserts = v.regras.filter((r) => r.limiteMinutos !== null).map((r) => ({ clinica_id: clinicaId, estagio_id: r.estagioId, limite_minutos: r.limiteMinutos as number, ativo: true, updated_at: agora }));
    const remover = v.regras.filter((r) => r.limiteMinutos === null).map((r) => r.estagioId);
    if (upserts.length > 0) {
      const { error: e1 } = await supabase.from("alertas_kanban_regras").upsert(upserts, { onConflict: "estagio_id" });
      if (e1) return { ok: false, error: "persist_failed" };
    }
    if (remover.length > 0) {
      const { error: e2 } = await supabase.from("alertas_kanban_regras").delete().eq("clinica_id", clinicaId).in("estagio_id", remover);
      if (e2) return { ok: false, error: "persist_failed" };
    }
  }

  await registrarEvento({
    clinicaId,
    atorId: ator.atendenteId,
    atorPerfil: ator.perfil,
    evento: "ALERTAS_CONFIG_ALTERADA",
    detalhes: { campos: Object.keys(v).filter((k) => k !== "ok") },
  });
  return { ok: true };
}

export async function registrarVerificacao(clinicaId: string, agora: Date, duracaoMs: number): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;
  await supabase.from("alertas_config").update({ ultima_verificacao_em: agora.toISOString(), ultima_verificacao_duracao_ms: duracaoMs }).eq("clinica_id", clinicaId);
}
