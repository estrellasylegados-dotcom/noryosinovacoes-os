import { getSupabaseServerClient } from "@/lib/supabase";
import { registrarEvento } from "@/lib/auditoria";
import {
  definicaoDoTipo,
  avaliarAcaoHumana,
  origensValidas,
  rankSeveridade,
  statusDestino,
  STATUS_ATIVOS,
  transicaoValida,
  type AcaoAlerta,
  type AtorAlerta,
  type Condicao,
  type Natureza,
  type Severidade,
  type StatusAlerta,
  type TipoAlerta,
} from "@/lib/alertas-tipos";

/**
 * Ciclo de vida do alerta — o único lugar que grava em `alertas`.
 *
 * Ideia central (um motor só, não dois): detecção por EVENTO e verificação
 * PERIÓDICA produzem o mesmo objeto — `Condicao` ("isto exige atenção") — e
 * passam pelas mesmas funções daqui: `aplicarCondicao` (criar/escalar/
 * deduplicar) e `liberarAlerta` (condição acabou → resolver). Dedupe e
 * "nova ocorrência" moram no banco (índice único em `chave_ativa`, v35), não
 * em memória: 2 processos criando ao mesmo tempo produzem 1 linha.
 *
 * Logs estruturados sem dado pessoal (só ids, tipo e severidade).
 */

type Cliente = NonNullable<ReturnType<typeof getSupabaseServerClient>>;

export type AlertaLinha = {
  id: string;
  clinicaId: string | null;
  tipo: string;
  categoria: string;
  natureza: Natureza;
  severidade: Severidade;
  status: StatusAlerta;
  titulo: string;
  descricao: string | null;
  tipoEntidade: string | null;
  entidadeId: string | null;
  responsavelId: string | null;
  chaveDeduplicacao: string;
  chaveAtiva: string | null;
  dados: Record<string, unknown>;
  detectadoEm: string;
  visualizadoEm: string | null;
  assumidoEm: string | null;
  assumidoPor: string | null;
  resolvidoEm: string | null;
  resolvidoPor: string | null;
  resolvidoPorEvento: string | null;
  ignoradoEm: string | null;
  ignoradoPor: string | null;
  ignoradoMotivo: string | null;
};

export function mapearAlerta(row: Record<string, unknown>): AlertaLinha {
  const s = (k: string) => (row[k] as string | null | undefined) ?? null;
  return {
    id: row.id as string,
    clinicaId: s("clinica_id"),
    tipo: row.tipo as string,
    categoria: row.categoria as string,
    natureza: (row.natureza as Natureza) ?? "operacional",
    severidade: row.severidade as Severidade,
    status: row.status as StatusAlerta,
    titulo: row.titulo as string,
    descricao: s("descricao"),
    tipoEntidade: s("tipo_entidade"),
    entidadeId: s("entidade_id"),
    responsavelId: s("responsavel_id"),
    chaveDeduplicacao: row.chave_deduplicacao as string,
    chaveAtiva: s("chave_ativa"),
    dados: (row.dados as Record<string, unknown> | null) ?? {},
    detectadoEm: row.detectado_em as string,
    visualizadoEm: s("visualizado_em"),
    assumidoEm: s("assumido_em"),
    assumidoPor: s("assumido_por"),
    resolvidoEm: s("resolvido_em"),
    resolvidoPor: s("resolvido_por"),
    resolvidoPorEvento: s("resolvido_por_evento"),
    ignoradoEm: s("ignorado_em"),
    ignoradoPor: s("ignorado_por"),
    ignoradoMotivo: s("ignorado_motivo"),
  };
}

function log(evento: string, dados: Record<string, unknown>): void {
  console.log(`[alertas] ${evento}`, JSON.stringify(dados));
}

async function registrarHistorico(
  supabase: Cliente,
  alerta: Pick<AlertaLinha, "id" | "clinicaId">,
  evento: "criado" | "severidade_alterada" | "responsavel_alterado" | "assumido" | "resolvido" | "ignorado" | "reaberto",
  extra: { de?: string | null; para?: string | null; atorId?: string | null; motivo?: string | null } = {}
): Promise<void> {
  const { error } = await supabase.from("alerta_historico").insert({
    alerta_id: alerta.id,
    clinica_id: alerta.clinicaId,
    evento,
    de: extra.de ?? null,
    para: extra.para ?? null,
    ator_id: extra.atorId ?? null,
    origem: extra.atorId ? "usuario" : "sistema",
    motivo: extra.motivo ?? null,
  });
  if (error) console.error("[alertas] historico_failed", JSON.stringify({ alertaId: alerta.id, evento, code: error.code ?? null }));
}

async function buscarPorChaveAtiva(supabase: Cliente, clinicaId: string, chave: string): Promise<AlertaLinha | null> {
  const { data } = await supabase.from("alertas").select("*").eq("clinica_id", clinicaId).eq("chave_ativa", chave).maybeSingle();
  return data ? mapearAlerta(data) : null;
}

// ---------------------------------------------------------------------------
// Criar / escalar / deduplicar
// ---------------------------------------------------------------------------

export type ResultadoCondicao = { resultado: "criado" | "escalado" | "reaberto" | "atualizado" | "deduplicado" | "erro"; alerta?: AlertaLinha };

/**
 * Aplica uma condição viva: cria, escala severidade (mesmo alerta, histórico
 * preservado) ou reconhece como duplicata. `existente` (quando o chamador já
 * carregou os alertas vivos) evita 1 consulta por condição no verificador.
 */
export async function aplicarCondicao(clinicaId: string, cond: Condicao, existente?: AlertaLinha | null): Promise<ResultadoCondicao> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { resultado: "erro" };
  const def = definicaoDoTipo(cond.tipo);
  if (!def) return { resultado: "erro" };

  const atual = existente === undefined ? await buscarPorChaveAtiva(supabase, clinicaId, cond.chave) : existente;

  if (!atual) {
    const { data, error } = await supabase
      .from("alertas")
      .insert({
        clinica_id: clinicaId,
        tipo: cond.tipo,
        categoria: def.categoria,
        natureza: def.natureza,
        severidade: cond.severidade,
        status: "aberto",
        titulo: cond.titulo,
        descricao: cond.descricao ?? null,
        tipo_entidade: cond.tipoEntidade,
        entidade_id: cond.entidadeId,
        responsavel_id: cond.responsavelId,
        chave_deduplicacao: cond.chave,
        chave_ativa: cond.chave,
        dados: cond.dados ?? {},
      })
      .select("*")
      .single();

    if (error || !data) {
      if (error?.code === "23505") {
        // Corrida: outro processo criou a mesma condição no mesmo instante. Não é erro — 1 condição = 1 alerta.
        const vencedor = await buscarPorChaveAtiva(supabase, clinicaId, cond.chave);
        if (vencedor) {
          log("alerta_deduplicado", { alertaId: vencedor.id, tipo: cond.tipo, motivo: "corrida_na_criacao" });
          return aplicarCondicao(clinicaId, cond, vencedor);
        }
      }
      console.error("[alertas] criar_failed", JSON.stringify({ tipo: cond.tipo, code: error?.code ?? null }));
      return { resultado: "erro" };
    }

    const criado = mapearAlerta(data);
    await registrarHistorico(supabase, criado, "criado", { para: cond.severidade, motivo: "deteccao" });
    log("alerta_criado", { alertaId: criado.id, tipo: cond.tipo, categoria: def.categoria, severidade: cond.severidade, entidade: cond.entidadeId });
    return { resultado: "criado", alerta: criado };
  }

  const patch: Record<string, unknown> = {};
  let resultado: ResultadoCondicao["resultado"] = "deduplicado";
  const encerradoPorPessoa = atual.status === "resolvido" || atual.status === "ignorado";

  if (rankSeveridade(cond.severidade) > rankSeveridade(atual.severidade)) {
    Object.assign(patch, {
      severidade: cond.severidade,
      titulo: cond.titulo,
      descricao: cond.descricao ?? null,
      dados: { ...atual.dados, ...(cond.dados ?? {}) },
    });
    // Ignorar/resolver "atenção" não pode esconder o "crítico" da MESMA ocorrência: a piora reabre.
    if (encerradoPorPessoa) {
      Object.assign(patch, {
        status: "aberto",
        resolvido_em: null,
        resolvido_por: null,
        resolvido_por_evento: null,
        ignorado_em: null,
        ignorado_por: null,
        ignorado_motivo: null,
      });
    }
    resultado = encerradoPorPessoa ? "reaberto" : "escalado";
  }

  if (!encerradoPorPessoa && cond.responsavelId !== atual.responsavelId) {
    patch.responsavel_id = cond.responsavelId;
    if (resultado === "deduplicado") resultado = "atualizado";
  }

  if (Object.keys(patch).length === 0) return { resultado: "deduplicado", alerta: atual };

  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("alertas").update(patch).eq("id", atual.id).select("*").maybeSingle();
  if (error || !data) {
    console.error("[alertas] atualizar_failed", JSON.stringify({ alertaId: atual.id, code: error?.code ?? null }));
    return { resultado: "erro", alerta: atual };
  }
  const novo = mapearAlerta(data);

  if (novo.severidade !== atual.severidade) {
    await registrarHistorico(supabase, novo, "severidade_alterada", { de: atual.severidade, para: novo.severidade, motivo: "deteccao" });
    log("alerta_escalado", { alertaId: novo.id, tipo: novo.tipo, de: atual.severidade, para: novo.severidade });
  }
  if (encerradoPorPessoa && novo.status === "aberto") {
    await registrarHistorico(supabase, novo, "reaberto", { de: atual.status, para: "aberto", motivo: "piora_de_severidade" });
  }
  if (novo.responsavelId !== atual.responsavelId) {
    await registrarHistorico(supabase, novo, "responsavel_alterado", { de: atual.responsavelId, para: novo.responsavelId, motivo: "deteccao" });
  }
  return { resultado, alerta: novo };
}

/** Caminho por evento (ex.: mensagem definitivamente falhou): nunca lança — alerta não pode derrubar o fluxo que o gerou. */
export async function abrirAlertaPorEvento(clinicaId: string, cond: Condicao): Promise<ResultadoCondicao> {
  try {
    const config = await lerTiposDesabilitados(clinicaId);
    if (config.includes(cond.tipo)) return { resultado: "deduplicado" };
    return await aplicarCondicao(clinicaId, cond);
  } catch (e) {
    console.error("[alertas] abrir_por_evento_falhou", JSON.stringify({ tipo: cond.tipo, message: (e as Error).message }));
    return { resultado: "erro" };
  }
}

async function lerTiposDesabilitados(clinicaId: string): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("alertas_config").select("tipos_desabilitados").eq("clinica_id", clinicaId).maybeSingle();
  return (data?.tipos_desabilitados as string[] | null) ?? [];
}

// ---------------------------------------------------------------------------
// Encerrar (condição acabou)
// ---------------------------------------------------------------------------

/**
 * A condição deixou de existir. Alerta ativo → resolvido (registrando QUAL
 * evento resolveu e, se houve, quem). Alerta já encerrado por pessoa
 * (resolvido/ignorado) só libera a chave: a próxima ocorrência vira alerta novo.
 */
export async function liberarAlerta(alerta: AlertaLinha, motivo: string, atorId: string | null = null): Promise<"resolvido" | "liberado" | "erro"> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return "erro";
  const agora = new Date().toISOString();

  if (STATUS_ATIVOS.includes(alerta.status)) {
    const { data, error } = await supabase
      .from("alertas")
      .update({ status: "resolvido", resolvido_em: agora, resolvido_por: atorId, resolvido_por_evento: motivo, chave_ativa: null, updated_at: agora })
      .eq("id", alerta.id)
      .in("status", [...STATUS_ATIVOS])
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[alertas] resolver_auto_failed", JSON.stringify({ alertaId: alerta.id, code: error.code ?? null }));
      return "erro";
    }
    if (data) {
      await registrarHistorico(supabase, alerta, "resolvido", { de: alerta.status, para: "resolvido", atorId, motivo });
      log("alerta_resolvido", { alertaId: alerta.id, tipo: alerta.tipo, evento: motivo, automatico: true });
      return "resolvido";
    }
    // Perdeu a corrida pra uma ação humana no mesmo instante: recarrega e só libera a chave.
  }

  const { error } = await supabase.from("alertas").update({ chave_ativa: null, updated_at: agora }).eq("id", alerta.id);
  return error ? "erro" : "liberado";
}

/** Evento de negócio que encerra a condição de uma entidade (resposta humana, conversa assumida, oportunidade movida…). Nunca lança. */
export async function resolverPorEvento(
  clinicaId: string,
  e: { tipos: TipoAlerta[]; tipoEntidade: string; entidadeId: string; evento: string; atorId?: string | null }
): Promise<number> {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return 0;
    const { data } = await supabase
      .from("alertas")
      .select("*")
      .eq("clinica_id", clinicaId)
      .eq("tipo_entidade", e.tipoEntidade)
      .eq("entidade_id", e.entidadeId)
      .in("tipo", e.tipos)
      .not("chave_ativa", "is", null);

    let resolvidos = 0;
    for (const row of data ?? []) {
      const r = await liberarAlerta(mapearAlerta(row), e.evento, e.atorId ?? null);
      if (r === "resolvido") resolvidos++;
    }
    return resolvidos;
  } catch (err) {
    console.error("[alertas] resolver_por_evento_falhou", JSON.stringify({ evento: e.evento, message: (err as Error).message }));
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Sincronização: "estado desejado" × "alertas vivos" (usada pelo verificador)
// ---------------------------------------------------------------------------

export type DeteccaoAlertas = {
  /** Tipos que ESTA detecção cobre por inteiro — só alertas desses tipos podem ser resolvidos por ausência. */
  tipos: TipoAlerta[];
  ativas: Condicao[];
  /** Chaves cuja condição está suspensa (ex.: SLA pausado fora do expediente): nem cria nem resolve. */
  manter?: string[];
  /** Evento que consta como "o que resolveu" quando a condição simplesmente some. */
  motivoEncerramento?: string;
  /** Motivo por chave (ex.: canal recuperado × canal pausado); cai no `motivoEncerramento`. */
  motivoPorChave?: (alerta: AlertaLinha) => string | undefined;
};

export type ResultadoSincronizacao = { criados: number; escalados: number; reabertos: number; atualizados: number; deduplicados: number; resolvidos: number; liberados: number; erros: number };

export function sincronizacaoVazia(): ResultadoSincronizacao {
  return { criados: 0, escalados: 0, reabertos: 0, atualizados: 0, deduplicados: 0, resolvidos: 0, liberados: 0, erros: 0 };
}

export async function sincronizarAlertas(clinicaId: string, d: DeteccaoAlertas): Promise<ResultadoSincronizacao> {
  const total = sincronizacaoVazia();
  const supabase = getSupabaseServerClient();
  if (!supabase || d.tipos.length === 0) return total;

  // 1 consulta: só os alertas com condição viva (índice parcial alertas_condicao_viva_idx).
  const { data, error } = await supabase.from("alertas").select("*").eq("clinica_id", clinicaId).in("tipo", d.tipos).not("chave_ativa", "is", null);
  if (error) {
    console.error("[alertas] carregar_vivos_failed", JSON.stringify({ code: error.code ?? null }));
    total.erros++;
    return total;
  }
  const vivos = new Map<string, AlertaLinha>();
  for (const row of data ?? []) {
    const a = mapearAlerta(row);
    if (a.chaveAtiva) vivos.set(a.chaveAtiva, a);
  }

  const chavesAtivas = new Set<string>();
  for (const cond of d.ativas) {
    chavesAtivas.add(cond.chave);
    const r = await aplicarCondicao(clinicaId, cond, vivos.get(cond.chave) ?? null);
    if (r.resultado === "criado") total.criados++;
    else if (r.resultado === "escalado") total.escalados++;
    else if (r.resultado === "reaberto") total.reabertos++;
    else if (r.resultado === "atualizado") total.atualizados++;
    else if (r.resultado === "deduplicado") total.deduplicados++;
    else total.erros++;
  }

  const suspensas = new Set(d.manter ?? []);
  for (const [chave, alerta] of vivos) {
    if (chavesAtivas.has(chave) || suspensas.has(chave)) continue;
    const def = definicaoDoTipo(alerta.tipo);
    // Fato pontual (ex.: fluxo falhou): sumir da detecção não o resolve — só a pessoa. Só libera a chave se já foi encerrado.
    if (def && !def.autoResolve && STATUS_ATIVOS.includes(alerta.status)) continue;
    const r = await liberarAlerta(alerta, d.motivoPorChave?.(alerta) ?? d.motivoEncerramento ?? "condicao_encerrada");
    if (r === "resolvido") total.resolvidos++;
    else if (r === "liberado") total.liberados++;
    else total.erros++;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Ações humanas
// ---------------------------------------------------------------------------

export type ErroAlerta = "backend_unavailable" | "not_found" | "forbidden" | "transicao_invalida" | "motivo_muito_longo" | "persist_failed";
export type ResultadoAcao = { ok: true; alerta: AlertaLinha } | { ok: false; error: ErroAlerta };
export type AtorAcaoAlerta = AtorAlerta & { perfil: string | null };

export const MOTIVO_MAX = 300;

const EVENTO_AUDITORIA: Record<AcaoAlerta, string> = { assumir: "ALERTA_ASSUMIDO", resolver: "ALERTA_RESOLVIDO", ignorar: "ALERTA_IGNORADO" };
const EVENTO_HISTORICO = { assumir: "assumido", resolver: "resolvido", ignorar: "ignorado" } as const;

/**
 * Validação de tudo no backend: clínica, visibilidade, permissão e transição.
 * A gravação é condicional ao status de origem (compare-and-set): duas
 * pessoas clicando juntas — só uma vence, a outra recebe `transicao_invalida`.
 */
export async function executarAcaoAlerta(
  clinicaId: string,
  alertaId: string,
  acao: AcaoAlerta,
  ator: AtorAcaoAlerta,
  opcoes: { motivo?: string | null } = {}
): Promise<ResultadoAcao> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const motivo = opcoes.motivo?.trim() || null;
  if (motivo && motivo.length > MOTIVO_MAX) return { ok: false, error: "motivo_muito_longo" };

  // clinica_id no filtro: alerta de outra clínica é "não encontrado", nunca "proibido" (não vaza existência).
  const { data: linha } = await supabase.from("alertas").select("*").eq("id", alertaId).eq("clinica_id", clinicaId).maybeSingle();
  if (!linha) return { ok: false, error: "not_found" };
  const alerta = mapearAlerta(linha);

  const permitido = avaliarAcaoHumana(ator, { tipo: alerta.tipo, responsavelId: alerta.responsavelId, status: alerta.status, assumidoPor: alerta.assumidoPor }, acao);
  if (!permitido.ok) return { ok: false, error: permitido.error };
  if (!transicaoValida(alerta.status, acao)) return { ok: false, error: "transicao_invalida" };

  const agora = new Date().toISOString();
  const patch: Record<string, unknown> = { status: statusDestino(acao), updated_at: agora };
  if (acao === "assumir") Object.assign(patch, { assumido_em: agora, assumido_por: ator.atendenteId });
  if (acao === "resolver") Object.assign(patch, { resolvido_em: agora, resolvido_por: ator.atendenteId, resolvido_por_evento: "manual" });
  if (acao === "ignorar") Object.assign(patch, { ignorado_em: agora, ignorado_por: ator.atendenteId, ignorado_motivo: motivo });
  // NÃO libera `chave_ativa`: se a condição ainda existe, o verificador não pode reabrir o mesmo alerta no minuto seguinte.

  const { data, error } = await supabase.from("alertas").update(patch).eq("id", alertaId).eq("clinica_id", clinicaId).in("status", [...origensValidas(acao)]).select("*").maybeSingle();
  if (error) {
    console.error("[alertas] acao_failed", JSON.stringify({ alertaId, acao, code: error.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }
  if (!data) return { ok: false, error: "transicao_invalida" };
  const novo = mapearAlerta(data);

  await registrarHistorico(supabase, novo, EVENTO_HISTORICO[acao], { de: alerta.status, para: novo.status, atorId: ator.atendenteId, motivo: acao === "resolver" ? "manual" : motivo });
  await registrarEvento({
    clinicaId,
    atorId: ator.atendenteId,
    atorPerfil: ator.perfil,
    evento: EVENTO_AUDITORIA[acao],
    alvoId: alertaId,
    detalhes: { tipo: alerta.tipo, severidade: alerta.severidade, ...(motivo ? { motivo } : {}) },
  });
  log(acao === "assumir" ? "alerta_assumido" : acao === "resolver" ? "alerta_resolvido" : "alerta_ignorado", { alertaId, tipo: alerta.tipo, atorId: ator.atendenteId, automatico: false });
  return { ok: true, alerta: novo };
}

export async function marcarVisualizados(clinicaId: string, ids: string[]): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase || ids.length === 0) return;
  await supabase.from("alertas").update({ visualizado_em: new Date().toISOString() }).eq("clinica_id", clinicaId).in("id", ids).is("visualizado_em", null);
}

export type EntradaHistorico = { id: string; evento: string; de: string | null; para: string | null; atorId: string | null; origem: string; motivo: string | null; quando: string };

export async function buscarHistoricoAlerta(clinicaId: string, alertaId: string): Promise<EntradaHistorico[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("alerta_historico").select("id, evento, de, para, ator_id, origem, motivo, created_at").eq("alerta_id", alertaId).eq("clinica_id", clinicaId).order("created_at", { ascending: true });
  return (data ?? []).map((h) => ({
    id: h.id as string,
    evento: h.evento as string,
    de: (h.de as string | null) ?? null,
    para: (h.para as string | null) ?? null,
    atorId: (h.ator_id as string | null) ?? null,
    origem: h.origem as string,
    motivo: (h.motivo as string | null) ?? null,
    quando: h.created_at as string,
  }));
}
