import { automacoesComerciaisHabilitadas, validarReferenciasComerciais } from "@/lib/fluxo-comercial";
import { getSupabaseServerClient } from "@/lib/supabase";
import { validarFormaDefinicao, type FluxoDefinicao } from "@/lib/fluxo-tipos";
import { validarGrafo, type ProblemaGrafo } from "@/lib/fluxo-validador";
import { gerarDefinicaoInicial } from "@/lib/fluxo-templates";

/**
 * CRUD + versionamento do "Fluxo de Conversa" (Fase 2b/3 — editor visual).
 * A engine (`fluxo-execucoes.ts`/`fluxo-motor.ts`) não muda: esta lib só
 * escreve `fluxos`/`fluxo_versoes` do jeito que a engine já espera ler.
 *
 * Regra central de versionamento (schema v20): só 1 `fluxo_versoes` com
 * `status='publicada'` por fluxo (índice único parcial), e o rascunho é
 * sempre sobrescrito na mesma linha — nunca ganha uma linha nova a cada
 * autosave. "Publicar" é o único momento que promove o rascunho atual e
 * rebaixa a publicada anterior; execuções em andamento continuam apontando
 * pro `versao_id` exato que já tinham (snapshot imutável), nunca afetadas.
 */

export type StatusFluxo = "ativo" | "pausado" | "arquivado";
export type StatusVersaoFluxo = "rascunho" | "publicada" | "substituida" | "arquivada";

export type ResultadoFluxo = { ok: boolean; id?: string; error?: string };

export type FluxoResumo = {
  id: string;
  nome: string;
  descricao: string | null;
  pasta: string | null;
  status: StatusFluxo;
  gatilhoTipo: string | null;
  versaoPublicadaNumero: number | null;
  versaoPublicadaEm: string | null;
  updatedAt: string;
};

export type FiltroListaFluxos = { status?: StatusFluxo };

export async function listarFluxos(clinicaId: string, filtro?: FiltroListaFluxos): Promise<FluxoResumo[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase.from("fluxos").select("id, nome, descricao, pasta, status, gatilho_tipo, updated_at").eq("clinica_id", clinicaId);
  if (filtro?.status) query = query.eq("status", filtro.status);

  const { data: fluxos, error } = await query.order("updated_at", { ascending: false });
  if (error || !fluxos || fluxos.length === 0) return [];

  const { data: versoes } = await supabase
    .from("fluxo_versoes")
    .select("fluxo_id, numero, publicado_em")
    .in("fluxo_id", fluxos.map((f) => f.id as string))
    .eq("status", "publicada");

  const publicadaPorFluxo = new Map((versoes ?? []).map((v) => [v.fluxo_id as string, v]));

  return fluxos.map((f) => {
    const publicada = publicadaPorFluxo.get(f.id as string);
    return {
      id: f.id as string,
      nome: f.nome as string,
      descricao: (f.descricao as string | null) ?? null,
      pasta: (f.pasta as string | null) ?? null,
      status: f.status as StatusFluxo,
      gatilhoTipo: (f.gatilho_tipo as string | null) ?? null,
      versaoPublicadaNumero: (publicada?.numero as number | undefined) ?? null,
      versaoPublicadaEm: (publicada?.publicado_em as string | null | undefined) ?? null,
      updatedAt: f.updated_at as string,
    };
  });
}

export type DadosNovoFluxo = { nome: string; descricao?: string | null; templateId?: string | null };

export async function criarFluxoComRascunhoInicial(
  clinicaId: string,
  dados: DadosNovoFluxo,
  criadoPor: string | null
): Promise<ResultadoFluxo> {
  const nome = dados.nome.trim();
  if (!nome) return { ok: false, error: "nome_obrigatorio" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data: fluxo, error: erroFluxo } = await supabase
    .from("fluxos")
    .insert({ clinica_id: clinicaId, nome, descricao: dados.descricao?.trim() || null, status: "pausado", criado_por: criadoPor })
    .select("id")
    .single();

  if (erroFluxo || !fluxo) {
    console.error("[fluxo-versoes] criar_fluxo_failed", JSON.stringify({ code: erroFluxo?.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  const fluxoId = fluxo.id as string;
  const definicao = gerarDefinicaoInicial(dados.templateId);

  const { error: erroVersao } = await supabase
    .from("fluxo_versoes")
    .insert({ fluxo_id: fluxoId, clinica_id: clinicaId, numero: 1, status: "rascunho", definicao });

  if (erroVersao) {
    console.error("[fluxo-versoes] criar_versao_failed", JSON.stringify({ fluxoId, code: erroVersao.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  return { ok: true, id: fluxoId };
}

export type DadosMetadadosFluxo = { nome?: string; descricao?: string | null; pasta?: string | null; podeInterromperAgenteIa?: boolean };

export async function atualizarMetadadosFluxo(clinicaId: string, id: string, dados: DadosMetadadosFluxo): Promise<ResultadoFluxo> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (dados.nome !== undefined) {
    const nome = dados.nome.trim();
    if (!nome) return { ok: false, error: "nome_obrigatorio" };
    patch.nome = nome;
  }
  if (dados.descricao !== undefined) patch.descricao = dados.descricao?.trim() || null;
  if (dados.pasta !== undefined) patch.pasta = dados.pasta?.trim() || null;
  if (dados.podeInterromperAgenteIa !== undefined) patch.pode_interromper_agente_ia = dados.podeInterromperAgenteIa;

  const { error } = await supabase.from("fluxos").update(patch).eq("id", id).eq("clinica_id", clinicaId);
  if (error) return { ok: false, error: "persist_failed" };
  return { ok: true, id };
}

export type FluxoParaEditor = {
  id: string;
  nome: string;
  descricao: string | null;
  pasta: string | null;
  status: StatusFluxo;
  podeInterromperAgenteIa: boolean;
  gatilhoTipo: string | null;
  gatilhoConfig: Record<string, unknown>;
  versaoId: string;
  versaoNumero: number;
  versaoStatus: StatusVersaoFluxo;
  definicao: FluxoDefinicao;
};

/** Rascunho se existir; senão a publicada mais recente. Um fluxo nunca fica sem versão editável — nasce sempre com a v1 em rascunho. */
export async function buscarFluxoParaEditor(clinicaId: string, id: string): Promise<FluxoParaEditor | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data: fluxo, error: erroFluxo } = await supabase
    .from("fluxos")
    .select("id, nome, descricao, pasta, status, pode_interromper_agente_ia, gatilho_tipo, gatilho_config")
    .eq("id", id)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (erroFluxo || !fluxo) return null;

  const { data: rascunho } = await supabase
    .from("fluxo_versoes")
    .select("id, numero, status, definicao")
    .eq("fluxo_id", id)
    .eq("clinica_id", clinicaId)
    .eq("status", "rascunho")
    .maybeSingle();

  const versaoRow =
    rascunho ??
    (
      await supabase
        .from("fluxo_versoes")
        .select("id, numero, status, definicao")
        .eq("fluxo_id", id)
        .eq("clinica_id", clinicaId)
        .eq("status", "publicada")
        .maybeSingle()
    ).data;

  if (!versaoRow) {
    console.error("[fluxo-versoes] sem_versao_editavel", JSON.stringify({ fluxoId: id }));
    return null;
  }

  const forma = validarFormaDefinicao(versaoRow.definicao);
  if (!forma.ok) {
    console.error(
      "[fluxo-versoes] definicao_invalida_ao_carregar",
      JSON.stringify({ fluxoId: id, versaoId: versaoRow.id, erro: forma.erro })
    );
    return null;
  }

  return {
    id: fluxo.id as string,
    nome: fluxo.nome as string,
    descricao: (fluxo.descricao as string | null) ?? null,
    pasta: (fluxo.pasta as string | null) ?? null,
    status: fluxo.status as StatusFluxo,
    podeInterromperAgenteIa: Boolean(fluxo.pode_interromper_agente_ia),
    gatilhoTipo: (fluxo.gatilho_tipo as string | null) ?? null,
    gatilhoConfig: (fluxo.gatilho_config as Record<string, unknown>) ?? {},
    versaoId: versaoRow.id as string,
    versaoNumero: versaoRow.numero as number,
    versaoStatus: versaoRow.status as StatusVersaoFluxo,
    definicao: forma.definicao,
  };
}

export type ResultadoSalvarRascunho = {
  ok: boolean;
  versaoId?: string;
  numero?: number;
  erros?: ProblemaGrafo[];
  avisos?: ProblemaGrafo[];
  error?: string;
};

/** Autosave: bloqueia (não escreve) se a FORMA for inválida; grafo nunca bloqueia aqui, só informa erros/avisos pro painel de validação. */
export async function salvarRascunho(clinicaId: string, fluxoId: string, definicaoBruta: unknown): Promise<ResultadoSalvarRascunho> {
  const forma = validarFormaDefinicao(definicaoBruta);
  if (!forma.ok) return { ok: false, error: forma.erro };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const grafo = validarGrafo(forma.definicao);

  const { data: rascunhoExistente } = await supabase
    .from("fluxo_versoes")
    .select("id, numero")
    .eq("fluxo_id", fluxoId)
    .eq("clinica_id", clinicaId)
    .eq("status", "rascunho")
    .maybeSingle();

  if (rascunhoExistente) {
    const { error } = await supabase
      .from("fluxo_versoes")
      .update({ definicao: forma.definicao, updated_at: new Date().toISOString() })
      .eq("id", rascunhoExistente.id)
      .eq("clinica_id", clinicaId);
    if (error) return { ok: false, error: "persist_failed" };
    return {
      ok: true,
      versaoId: rascunhoExistente.id as string,
      numero: rascunhoExistente.numero as number,
      erros: grafo.erros,
      avisos: grafo.avisos,
    };
  }

  // Nenhum rascunho ainda (fluxo só tem a publicada): fork lazy — cria uma
  // versão nova, nunca sobrescreve o snapshot publicado.
  const { data: ultimaVersao } = await supabase
    .from("fluxo_versoes")
    .select("numero")
    .eq("fluxo_id", fluxoId)
    .eq("clinica_id", clinicaId)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();

  const numero = ((ultimaVersao?.numero as number | undefined) ?? 0) + 1;

  const { data: nova, error } = await supabase
    .from("fluxo_versoes")
    .insert({ fluxo_id: fluxoId, clinica_id: clinicaId, numero, status: "rascunho", definicao: forma.definicao })
    .select("id")
    .single();

  if (error || !nova) return { ok: false, error: "persist_failed" };
  return { ok: true, versaoId: nova.id as string, numero, erros: grafo.erros, avisos: grafo.avisos };
}

export type ResultadoPublicar = { ok: boolean; versaoId?: string; erros?: ProblemaGrafo[]; error?: string };

export async function publicarFluxo(clinicaId: string, fluxoId: string, atendenteId: string | null): Promise<ResultadoPublicar> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data: rascunho, error: erroRascunho } = await supabase
    .from("fluxo_versoes")
    .select("id, definicao")
    .eq("fluxo_id", fluxoId)
    .eq("clinica_id", clinicaId)
    .eq("status", "rascunho")
    .maybeSingle();
  if (erroRascunho || !rascunho) return { ok: false, error: "sem_rascunho" };

  const forma = validarFormaDefinicao(rascunho.definicao);
  if (!forma.ok) return { ok: false, error: "definicao_invalida" };

  // Nunca confia no que foi validado quando o admin testou — revalida tudo
  // aqui, é o único gate real antes de virar produção.
  const grafo = validarGrafo(forma.definicao);
  if (grafo.erros.length > 0) return { ok: false, erros: grafo.erros, error: "grafo_invalido" };

  const erroReferencia = await validarReferenciasComerciais(clinicaId, forma.definicao);
  if (erroReferencia) return { ok: false, error: erroReferencia };
  const { data: publicou, error } = await supabase.rpc("fluxo_publicar", { p_clinica: clinicaId, p_fluxo: fluxoId, p_versao: rascunho.id, p_ator: atendenteId, p_definicao: forma.definicao });
  if (error || !publicou) return { ok: false, error: "publicacao_conflito" };

  return { ok: true, versaoId: rascunho.id as string };
}

export async function atualizarStatusFluxo(clinicaId: string, fluxoId: string, status: StatusFluxo, atendenteId: string | null, interromperExecucoes = false): Promise<ResultadoFluxo> {
  const db = getSupabaseServerClient();
  if (!db) return { ok: false, error: "backend_unavailable" };
  if (status === "ativo") {
    const fluxo = await buscarFluxoParaEditor(clinicaId, fluxoId);
    if (!fluxo) return { ok: false, error: "not_found" };
    if (fluxo.gatilhoTipo === "kanban_stage_changed" && !automacoesComerciaisHabilitadas()) return { ok: false, error: "comercial_nao_habilitado" };
  }
  const { data, error } = await db.rpc("fluxo_alterar_status", { p_clinica: clinicaId, p_fluxo: fluxoId, p_status: status, p_ator: atendenteId, p_interromper: interromperExecucoes });
  return error ? { ok: false, error: "persist_failed" } : data;
}

export function isStatusFluxoValido(valor: string): valor is StatusFluxo {
  return valor === "ativo" || valor === "pausado" || valor === "arquivado";
}
