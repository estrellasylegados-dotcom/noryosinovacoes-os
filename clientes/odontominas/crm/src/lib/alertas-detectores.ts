import { getSupabaseServerClient } from "@/lib/supabase";
import { listarCanais, verificarSaudeCanal, type StatusCanal } from "@/lib/canais";
import { ERROS_DE_CANAL } from "@/lib/canais-envio";
import { derivarCicloDeMensagens, minutosEntre, statusSlaDoCiclo, type ContextoSla, type StatusSlaConversa } from "@/lib/sla";
import { chaves, type Condicao } from "@/lib/alertas-tipos";
import type { DeteccaoAlertas } from "@/lib/alertas";
import type { ConfigVerificador } from "@/lib/alertas-config";

/**
 * Detectores: transformam o ESTADO ATUAL do sistema em `Condicao`s. Nenhum
 * grava alerta (isso é `sincronizarAlertas`) e nenhum recalcula SLA (usam
 * `statusSlaDoCiclo`). Cada função `avaliar…`/`condicoes…` é pura e testada
 * direto; o I/O em volta só reúne os candidatos, sempre por filtro de estado/
 * data (nada de varrer tabela inteira).
 *
 * Regra de ouro (fadiga de alertas): "isso exige ação humana?". Não →
 * fica em log/métrica, não vira alerta. Ver docs/ALERTAS.md.
 */

export type ContextoVerificacao = {
  clinicaId: string;
  agora: Date;
  config: ConfigVerificador;
  sla: ContextoSla;
};

const DIA_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

/** Janela de "fato recente" dos alertas por evento pontual (falha de fluxo/disparo). Depois disso é histórico, não fila. */
export const JANELA_FATOS_MS = 7 * DIA_MS;
/** Teto por regra do Kanban: 500 leads parados não podem virar 500 alertas (fadiga). Os mais antigos primeiro. */
export const LIMITE_POR_REGRA_KANBAN = 100;
export const LIMITE_FALHAS_FLUXO = 20;
export const TRAVA_FLUXO_MINUTOS = 15;
export const MENSAGENS_POR_CONVERSA = 100;

// ---------------------------------------------------------------------------
// Conversa: SLA + sem responsável (mesmas conversas, mesmo ciclo — 1 leitura)
// ---------------------------------------------------------------------------

export type EntradaConversa = {
  conversaId: string;
  atribuidoA: string | null;
  /** 'humano' | 'agente_ia' | 'fluxo' — só conversa em repouso humano conta como "sem responsável". */
  dono: string;
  ciclo: { mensagemId: string; inicioEm: string } | null;
  statusSla: StatusSlaConversa | null;
  minutosSemResponsavel: number;
  limiteSemResponsavelMinutos: number;
};

export type CondicoesConversa = {
  sla: Condicao | null;
  /** Chave do SLA suspensa (fora do expediente): não cria nem resolve. */
  slaSuspensoChave: string | null;
  semResponsavel: Condicao | null;
  /** SLA em atenção/estourado agora — o Kanban não repete o mesmo problema (paciente esperando resposta). */
  slaAtivo: boolean;
};

export function condicoesDaConversa(e: EntradaConversa): CondicoesConversa {
  const vazio: CondicoesConversa = { sla: null, slaSuspensoChave: null, semResponsavel: null, slaAtivo: false };
  if (!e.ciclo) return vazio;

  const semDono = e.atribuidoA === null && e.dono === "humano";
  let sla: Condicao | null = null;
  let slaSuspensoChave: string | null = null;
  let estourado = false;

  const s = e.statusSla;
  if (s && s.tipo !== "not_configured" && s.tipo !== "sem_ciclo" && s.tipo !== "ok") {
    const chave = chaves.sla(e.conversaId, s.cicloMensagemId);
    if (s.tipo === "paused") {
      slaSuspensoChave = chave;
    } else {
      estourado = s.tipo === "breached";
      sla = {
        tipo: "sla_limite",
        chave,
        severidade: estourado ? "critico" : "atencao",
        titulo: estourado ? "SLA estourado" : "SLA próximo do limite",
        descricao:
          `Paciente aguardando resposta há ${s.minutosConsumidos} min (limite de ${s.limiteMinutos} min).` + (semDono ? " Sem responsável: alguém precisa assumir a conversa." : ""),
        tipoEntidade: "conversa",
        entidadeId: e.conversaId,
        responsavelId: e.atribuidoA,
        dados: {
          cicloTipo: s.cicloTipo,
          cicloMensagemId: s.cicloMensagemId,
          cicloInicioEm: s.cicloInicioEm,
          limiteMinutos: s.limiteMinutos,
          minutosNaDeteccao: s.minutosConsumidos,
          semResponsavel: semDono,
        },
      };
    }
  }

  // SLA estourado já diz "ninguém respondeu" (e o texto cita a falta de dono): repetir como "sem responsável" seria o mesmo problema duas vezes.
  let semResponsavel: Condicao | null = null;
  if (semDono && !estourado && e.minutosSemResponsavel >= e.limiteSemResponsavelMinutos) {
    semResponsavel = {
      tipo: "conversa_sem_responsavel",
      chave: chaves.semResponsavel(e.conversaId, e.ciclo.mensagemId),
      severidade: "atencao",
      titulo: "Conversa sem responsável",
      descricao: `Paciente aguardando há ${e.minutosSemResponsavel} min e ninguém assumiu a conversa.`,
      tipoEntidade: "conversa",
      entidadeId: e.conversaId,
      responsavelId: null,
      dados: { cicloMensagemId: e.ciclo.mensagemId, cicloInicioEm: e.ciclo.inicioEm, limiteMinutos: e.limiteSemResponsavelMinutos },
    };
  }

  return { sla, slaSuspensoChave, semResponsavel, slaAtivo: sla !== null };
}

type LinhaConversa = { id: string; atribuido_a: string | null; dono_conversa: string | null; status: string };

async function emLotes<T, R>(itens: T[], tamanho: number, fn: (i: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += tamanho) saida.push(...(await Promise.all(itens.slice(i, i + tamanho).map(fn))));
  return saida;
}

export type DeteccaoConversas = { sla: DeteccaoAlertas; semResponsavel: DeteccaoAlertas; conversasComSla: Set<string> };

export async function detectarConversas(ctx: ContextoVerificacao): Promise<DeteccaoConversas> {
  const sla: DeteccaoAlertas = { tipos: ["sla_limite"], ativas: [], manter: [] };
  const semResponsavel: DeteccaoAlertas = { tipos: ["conversa_sem_responsavel"], ativas: [] };
  const conversasComSla = new Set<string>();

  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("backend_unavailable");

  // Só conversas com ciclo potencial (novo/aguardando), fora das arquivadas — índice conversas_sem_responsavel_idx cobre o recorte sem dono.
  const { data, error } = await supabase
    .from("conversas")
    .select("id, atribuido_a, dono_conversa, status")
    .eq("clinica_id", ctx.clinicaId)
    .in("status", ["novo", "aguardando"])
    .eq("arquivada", false);
  if (error) throw new Error(`conversas_${error.code ?? "erro"}`);

  const slaLigado = ctx.sla.config.ativo && (!ctx.sla.config.considerarApenasHorarioUtil || ctx.sla.horarioConfigurado);
  const horarioUtil = ctx.sla.horarioConfigurado ? ctx.sla.horario : null;

  await emLotes((data ?? []) as LinhaConversa[], 16, async (c) => {
    // 1 consulta por conversa: as `MENSAGENS_POR_CONVERSA` mais recentes bastam pra achar o ciclo aberto (última resposta humana + 1ª recebida depois).
    const { data: msgs, error: erroMsgs } = await supabase
      .from("mensagens")
      .select("id, direcao, enviada_por_atendente_id, created_at")
      .eq("conversa_id", c.id)
      .order("created_at", { ascending: false })
      .limit(MENSAGENS_POR_CONVERSA);
    if (erroMsgs) throw new Error(`mensagens_${erroMsgs.code ?? "erro"}`);
    const ciclo = derivarCicloDeMensagens(
      (msgs ?? []).map((m) => ({ id: m.id as string, direcao: m.direcao as "recebida" | "enviada", enviadaPorAtendenteId: (m.enviada_por_atendente_id as string | null) ?? null, createdAt: m.created_at as string }))
    );
    if (!ciclo) return;

    const statusSla = slaLigado ? statusSlaDoCiclo(ctx.sla.config, ctx.sla.config.considerarApenasHorarioUtil ? ctx.sla.horario : null, ciclo, ctx.agora) : null;
    const r = condicoesDaConversa({
      conversaId: c.id,
      atribuidoA: c.atribuido_a,
      dono: c.dono_conversa ?? "humano",
      ciclo,
      statusSla,
      minutosSemResponsavel: minutosEntre(new Date(ciclo.inicioEm), ctx.agora, horarioUtil, horarioUtil !== null),
      limiteSemResponsavelMinutos: ctx.config.semResponsavelMinutos,
    });

    if (r.sla) sla.ativas.push(r.sla);
    if (r.slaSuspensoChave) sla.manter!.push(r.slaSuspensoChave);
    if (r.semResponsavel) semResponsavel.ativas.push(r.semResponsavel);
    if (r.slaAtivo) conversasComSla.add(c.id);
  });

  return { sla, semResponsavel, conversasComSla };
}

// ---------------------------------------------------------------------------
// Kanban: oportunidade parada na etapa
// ---------------------------------------------------------------------------

export type EntradaOportunidade = {
  oportunidadeId: string;
  estagioId: string;
  estagioNome: string;
  regraId: string;
  limiteMinutos: number;
  minutosNaEtapa: number;
  responsavelId: string | null;
  conversaId: string | null;
  entrouEm: string;
  /** A conversa dela já tem alerta de SLA: o paciente está esperando resposta, e esse alerta já cobre o problema. */
  conversaComSlaAtivo: boolean;
};

export function condicaoOportunidadeParada(e: EntradaOportunidade): Condicao | null {
  if (e.minutosNaEtapa < e.limiteMinutos || e.conversaComSlaAtivo) return null;
  return {
    tipo: "oportunidade_parada",
    chave: chaves.oportunidadeParada(e.oportunidadeId, e.estagioId, e.regraId),
    severidade: "atencao",
    titulo: `Oportunidade parada em "${e.estagioNome}"`,
    descricao: `Está nesta etapa há ${formatarMinutos(e.minutosNaEtapa)} (limite configurado: ${formatarMinutos(e.limiteMinutos)}).`,
    tipoEntidade: "oportunidade",
    entidadeId: e.oportunidadeId,
    responsavelId: e.responsavelId,
    dados: { estagioId: e.estagioId, estagioNome: e.estagioNome, regraId: e.regraId, limiteMinutos: e.limiteMinutos, entrouEm: e.entrouEm, conversaId: e.conversaId },
  };
}

export function formatarMinutos(min: number): string {
  if (min >= 24 * 60) {
    const d = Math.floor(min / (24 * 60));
    return `${d} ${d === 1 ? "dia" : "dias"}`;
  }
  if (min >= 60) {
    const h = Math.floor(min / 60);
    return `${h} h`;
  }
  return `${min} min`;
}

export async function detectarKanban(ctx: ContextoVerificacao, conversasComSla: Set<string>): Promise<DeteccaoAlertas> {
  const det: DeteccaoAlertas = { tipos: ["oportunidade_parada"], ativas: [] };
  if (ctx.config.regrasKanban.length === 0) return det;

  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("backend_unavailable");

  const { data: estagios } = await supabase.from("pipeline_estagios").select("id, nome").eq("clinica_id", ctx.clinicaId).in("id", ctx.config.regrasKanban.map((r) => r.estagioId));
  const nomes = new Map((estagios ?? []).map((e) => [e.id as string, e.nome as string]));
  const horarioUtil = ctx.sla.horarioConfigurado ? ctx.sla.horario : null;

  for (const regra of ctx.config.regrasKanban) {
    // Minutos corridos ≥ minutos úteis: filtrar por corridos no banco é condição NECESSÁRIA, o cálculo fino vem depois.
    const corte = new Date(ctx.agora.getTime() - regra.limiteMinutos * MIN_MS).toISOString();
    const { data, error } = await supabase
      .from("oportunidades")
      .select("id, responsavel_id, conversa_id, estagio_entrou_em")
      .eq("clinica_id", ctx.clinicaId)
      .eq("estagio_id", regra.estagioId)
      .eq("status", "open")
      .lte("estagio_entrou_em", corte)
      .order("estagio_entrou_em", { ascending: true })
      .limit(LIMITE_POR_REGRA_KANBAN);
    if (error) throw new Error(`kanban_${error.code ?? "erro"}`);

    for (const o of data ?? []) {
      const entrouEm = o.estagio_entrou_em as string;
      const cond = condicaoOportunidadeParada({
        oportunidadeId: o.id as string,
        estagioId: regra.estagioId,
        estagioNome: nomes.get(regra.estagioId) ?? "etapa",
        regraId: regra.id,
        limiteMinutos: regra.limiteMinutos,
        minutosNaEtapa: minutosEntre(new Date(entrouEm), ctx.agora, horarioUtil, horarioUtil !== null),
        responsavelId: (o.responsavel_id as string | null) ?? null,
        conversaId: (o.conversa_id as string | null) ?? null,
        entrouEm,
        conversaComSlaAtivo: Boolean(o.conversa_id && conversasComSla.has(o.conversa_id as string)),
      });
      if (cond) det.ativas.push(cond);
    }
  }
  return det;
}

// ---------------------------------------------------------------------------
// Canal desconectado / com erro
// ---------------------------------------------------------------------------

export type DecisaoCanal = "alertar" | "ok" | "suspender";

/**
 * `unknown` = não deu pra confirmar agora (sem credencial, provedor sem resposta
 * legível): NÃO é queda confirmada — suspende (não cria, não resolve). Queda
 * só vira alerta depois da carência (piscada de rede não acorda ninguém).
 */
export function decidirCanal(e: { status: StatusCanal; ativo: boolean; statusDesde: Date | null; agora: Date; carenciaMinutos: number }): DecisaoCanal {
  if (!e.ativo) return "ok";
  if (e.status === "connected" || e.status === "connecting") return "ok";
  if (e.status === "unknown") return "suspender";
  const desde = e.statusDesde?.getTime() ?? 0;
  return e.agora.getTime() - desde >= e.carenciaMinutos * MIN_MS ? "alertar" : "suspender";
}

export async function detectarCanais(ctx: ContextoVerificacao): Promise<DeteccaoAlertas> {
  const det: DeteccaoAlertas = {
    tipos: ["canal_desconectado"],
    ativas: [],
    manter: [],
    motivoEncerramento: "canal_recuperado",
    motivoPorChave: undefined,
  };

  const canais = await listarCanais(ctx.clinicaId);
  const pausados = new Set(canais.filter((c) => !c.ativo).map((c) => c.id));
  det.motivoPorChave = (a) => (a.entidadeId && pausados.has(a.entidadeId) ? "canal_pausado" : undefined);

  const ativos = canais.filter((c) => c.ativo);
  if (ativos.length === 0) return det;

  // Estado AO VIVO no provedor (o status salvo é só cache) — reaproveita o serviço de saúde que a tela de Canais já usa.
  const saudes = await Promise.allSettled(ativos.map((c) => verificarSaudeCanal(c)));

  const supabase = getSupabaseServerClient();
  const { data: linhas } = supabase ? await supabase.from("canais").select("id, updated_at").eq("clinica_id", ctx.clinicaId).in("id", ativos.map((c) => c.id)) : { data: [] };
  const desde = new Map((linhas ?? []).map((l) => [l.id as string, new Date(l.updated_at as string)]));

  ativos.forEach((canal, i) => {
    const chave = chaves.canal(canal.id);
    const s = saudes[i];
    if (s.status === "rejected") {
      det.manter!.push(chave);
      return;
    }
    const decisao = decidirCanal({ status: s.value.status, ativo: canal.ativo, statusDesde: desde.get(canal.id) ?? null, agora: ctx.agora, carenciaMinutos: ctx.config.canalCarenciaMinutos });
    if (decisao === "suspender") {
      det.manter!.push(chave);
    } else if (decisao === "alertar") {
      const comErro = s.value.status === "error";
      det.ativas.push({
        tipo: "canal_desconectado",
        chave,
        severidade: "critico",
        titulo: comErro ? "Canal com erro de conexão" : "Canal desconectado",
        descricao: comErro
          ? "Não foi possível confirmar a conexão do WhatsApp deste canal. Mensagens podem não estar chegando nem saindo."
          : "O WhatsApp deste canal está desconectado: novas mensagens não chegam e as respostas não saem até reconectar.",
        tipoEntidade: "canal",
        entidadeId: canal.id,
        responsavelId: null,
        dados: { statusProvedor: s.value.status, ultimoWebhookEm: s.value.lastWebhookAt, ultimoErro: s.value.lastError ? s.value.lastError.slice(0, 120) : null },
      });
    }
  });
  return det;
}

// ---------------------------------------------------------------------------
// Fluxo: falhou (estado real 'failed') e preso (estados reais sem avançar)
// ---------------------------------------------------------------------------

/** `opt_out` é cancelamento correto; `recovery_apos_restart` acontece a cada deploy (métrica, não fila de trabalho). */
export const ERROS_DE_FLUXO_IGNORADOS = new Set(["opt_out", "recovery_apos_restart"]);

export function condicaoFluxoFalhou(e: { execucaoId: string; fluxoId: string; conversaId: string; erro: string | null; finalizadoEm: string }): Condicao | null {
  if (e.erro && ERROS_DE_FLUXO_IGNORADOS.has(e.erro)) return null;
  return {
    tipo: "fluxo_falhou",
    chave: chaves.fluxoFalhou(e.execucaoId),
    severidade: "atencao",
    titulo: "Fluxo de conversa falhou",
    descricao: "A automação terminou em erro e o paciente pode não ter recebido o atendimento previsto. Confira a conversa e, se preciso, siga manualmente.",
    tipoEntidade: "fluxo_execucao",
    entidadeId: e.execucaoId,
    responsavelId: null,
    dados: { fluxoId: e.fluxoId, conversaId: e.conversaId, erro: (e.erro ?? "desconhecido").slice(0, 120), finalizadoEm: e.finalizadoEm },
  };
}

export function condicaoFluxoPreso(e: { execucaoId: string; fluxoId: string; conversaId: string; estado: string; parouEm: string; minutosParado: number }): Condicao {
  return {
    tipo: "fluxo_preso",
    chave: chaves.fluxoPreso(e.execucaoId),
    severidade: "atencao",
    titulo: "Execução de fluxo travada",
    descricao: `A execução está em "${e.estado}" há ${e.minutosParado} min sem o motor processar. Provável problema do worker.`,
    tipoEntidade: "fluxo_execucao",
    entidadeId: e.execucaoId,
    responsavelId: null,
    dados: { fluxoId: e.fluxoId, conversaId: e.conversaId, estado: e.estado, parouEm: e.parouEm },
  };
}

export async function detectarFluxos(ctx: ContextoVerificacao): Promise<{ falhou: DeteccaoAlertas; preso: DeteccaoAlertas }> {
  const falhou: DeteccaoAlertas = { tipos: ["fluxo_falhou"], ativas: [] };
  const preso: DeteccaoAlertas = { tipos: ["fluxo_preso"], ativas: [], motivoEncerramento: "execucao_retomada" };

  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("backend_unavailable");

  const desde = new Date(ctx.agora.getTime() - JANELA_FATOS_MS).toISOString();
  const { data: falhas, error: e1 } = await supabase
    .from("fluxo_execucoes")
    .select("id, fluxo_id, conversa_id, erro, finalizado_em")
    .eq("clinica_id", ctx.clinicaId)
    .eq("estado", "failed")
    .eq("is_test", false)
    .gte("finalizado_em", desde)
    .order("finalizado_em", { ascending: false })
    .limit(LIMITE_FALHAS_FLUXO);
  if (e1) throw new Error(`fluxo_falhas_${e1.code ?? "erro"}`);

  for (const f of falhas ?? []) {
    const c = condicaoFluxoFalhou({ execucaoId: f.id as string, fluxoId: f.fluxo_id as string, conversaId: f.conversa_id as string, erro: (f.erro as string | null) ?? null, finalizadoEm: f.finalizado_em as string });
    if (c) falhou.ativas.push(c);
  }

  const corte = new Date(ctx.agora.getTime() - TRAVA_FLUXO_MINUTOS * MIN_MS).toISOString();
  const [{ data: emAndamento, error: e2 }, { data: vencidas, error: e3 }] = await Promise.all([
    supabase.from("fluxo_execucoes").select("id, fluxo_id, conversa_id, estado, updated_at").eq("clinica_id", ctx.clinicaId).eq("is_test", false).in("estado", ["queued", "running"]).lte("updated_at", corte).limit(20),
    // waiting_*: `aguardando_ate` já passou faz tempo e o motor não retomou (waiting_input: é o deadline do timeout).
    supabase.from("fluxo_execucoes").select("id, fluxo_id, conversa_id, estado, aguardando_ate").eq("clinica_id", ctx.clinicaId).eq("is_test", false).in("estado", ["waiting_time", "waiting_input"]).lte("aguardando_ate", corte).limit(20),
  ]);
  if (e2 || e3) throw new Error(`fluxo_presas_${(e2 ?? e3)?.code ?? "erro"}`);

  for (const p of [...(emAndamento ?? []), ...(vencidas ?? [])]) {
    const parouEm = ((p as Record<string, unknown>).aguardando_ate ?? (p as Record<string, unknown>).updated_at) as string;
    preso.ativas.push(
      condicaoFluxoPreso({
        execucaoId: p.id as string,
        fluxoId: p.fluxo_id as string,
        conversaId: p.conversa_id as string,
        estado: p.estado as string,
        parouEm,
        minutosParado: Math.floor((ctx.agora.getTime() - new Date(parouEm).getTime()) / MIN_MS),
      })
    );
  }
  return { falhou, preso };
}

// ---------------------------------------------------------------------------
// Disparos: falhas do PRÓPRIO envio (queda de canal já tem alerta e não conta aqui)
// ---------------------------------------------------------------------------

export function condicaoDisparoComFalhas(e: { disparoId: string; nome: string; falhasProprias: number; enviados: number; concluidoEm: string }): Condicao | null {
  if (e.falhasProprias <= 0) return null;
  return {
    tipo: "disparo_falhas",
    chave: chaves.disparo(e.disparoId),
    severidade: "atencao",
    titulo: "Disparo concluído com falhas",
    descricao: `${e.falhasProprias} ${e.falhasProprias === 1 ? "mensagem não foi entregue" : "mensagens não foram entregues"} (${e.enviados} enviadas com sucesso). Confira os números e, se preciso, reenvie.`,
    tipoEntidade: "disparo",
    entidadeId: e.disparoId,
    responsavelId: null,
    dados: { nome: e.nome.slice(0, 80), falhas: e.falhasProprias, enviados: e.enviados, concluidoEm: e.concluidoEm },
  };
}

export async function detectarDisparos(ctx: ContextoVerificacao): Promise<DeteccaoAlertas> {
  const det: DeteccaoAlertas = { tipos: ["disparo_falhas"], ativas: [] };
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("backend_unavailable");

  const desde = new Date(ctx.agora.getTime() - JANELA_FATOS_MS).toISOString();
  const { data, error } = await supabase
    .from("disparos")
    .select("id, nome, total_enviados, concluido_em")
    .eq("clinica_id", ctx.clinicaId)
    .eq("status", "concluida")
    .gt("total_falhas", 0)
    .gte("concluido_em", desde)
    .order("concluido_em", { ascending: false })
    .limit(10);
  if (error) throw new Error(`disparos_${error.code ?? "erro"}`);

  for (const d of data ?? []) {
    const { count } = await supabase
      .from("disparo_destinatarios")
      .select("id", { count: "exact", head: true })
      .eq("disparo_id", d.id as string)
      .eq("status", "falha")
      .or(`erro.is.null,erro.not.in.(${ERROS_DE_CANAL.join(",")})`);
    const c = condicaoDisparoComFalhas({ disparoId: d.id as string, nome: d.nome as string, falhasProprias: count ?? 0, enviados: (d.total_enviados as number | null) ?? 0, concluidoEm: d.concluido_em as string });
    if (c) det.ativas.push(c);
  }
  return det;
}
