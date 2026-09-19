import { getSupabaseServerClient } from "@/lib/supabase";
import { avaliarHorarioAtendimento, buscarConfiguracaoHorario, calcularMinutosUteisAtendimento, type ConfiguracaoHorario } from "@/lib/horario-atendimento";
import { STATUS_RESOLVIDOS, type StatusConversa } from "@/lib/status";

/**
 * SLA operacional por horário útil (ver relatório da fatia) — fundação:
 * config + cálculo + status + evento, SEM conectar em automação nenhuma
 * (WhatsApp/e-mail, transferência automática, Kanban). Núcleo de decisão
 * puro (avaliarStatusPorMinutos) testado direto; I/O (busca de ciclo,
 * config, evento) sem teste direto, mesmo critério do resto do projeto.
 */

export type SlaConfig = {
  clinicaId: string;
  ativo: boolean;
  primeiraRespostaMinutos: number;
  respostaAtendimentoMinutos: number;
  alertaPercentual: number;
  /** true (padrão) = SLA em minutos úteis (calcularMinutosUteisAtendimento); false = minutos corridos, sem pausa fora do expediente — escolha explícita do admin, nunca um default silencioso. */
  considerarApenasHorarioUtil: boolean;
};

export type TipoCicloSla = "primeira_resposta" | "resposta_atendimento";
export type NivelStatusSla = "ok" | "warning" | "breached" | "paused";

export type StatusSlaConversa =
  | { tipo: "not_configured" }
  | { tipo: "sem_ciclo" }
  | {
      tipo: NivelStatusSla;
      cicloTipo: TipoCicloSla;
      cicloMensagemId: string;
      cicloInicioEm: string;
      limiteMinutos: number;
      minutosConsumidos: number;
      percentual: number;
    };

// ---------------------------------------------------------------------------
// Núcleo puro — testável direto, sem Supabase.
// ---------------------------------------------------------------------------

/**
 * Decisão de status a partir de números já calculados — separada do I/O pra
 * ser testável sem mock de banco. `dentroDoHorarioAgora` só importa quando
 * `respeitaHorario=true`; SLA em minutos corridos nunca pausa.
 */
export function avaliarStatusPorMinutos(
  minutosConsumidos: number,
  limiteMinutos: number,
  alertaPercentual: number,
  dentroDoHorarioAgora: boolean,
  respeitaHorario: boolean
): NivelStatusSla {
  if (minutosConsumidos >= limiteMinutos) return "breached";
  if (respeitaHorario && !dentroDoHorarioAgora) return "paused";
  const percentual = limiteMinutos > 0 ? (minutosConsumidos / limiteMinutos) * 100 : 100;
  return percentual >= alertaPercentual ? "warning" : "ok";
}

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0 ? (ordenados[meio - 1] + ordenados[meio]) / 2 : ordenados[meio];
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

function linhaParaConfig(clinicaId: string, linha: Record<string, unknown> | null): SlaConfig {
  if (!linha) {
    return {
      clinicaId,
      ativo: false,
      primeiraRespostaMinutos: 15,
      respostaAtendimentoMinutos: 30,
      alertaPercentual: 80,
      considerarApenasHorarioUtil: true,
    };
  }
  return {
    clinicaId,
    ativo: Boolean(linha.ativo),
    primeiraRespostaMinutos: linha.primeira_resposta_minutos as number,
    respostaAtendimentoMinutos: linha.resposta_atendimento_minutos as number,
    alertaPercentual: linha.alerta_percentual as number,
    considerarApenasHorarioUtil: Boolean(linha.considerar_apenas_horario_util),
  };
}

/** Sem linha ainda = SLA nunca configurado — devolve defaults (inativo), nunca null (mesmo critério de reputacao-config.ts). */
export async function buscarSlaConfig(clinicaId: string): Promise<SlaConfig> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return linhaParaConfig(clinicaId, null);

  const { data } = await supabase.from("sla_config").select("*").eq("clinica_id", clinicaId).maybeSingle();
  return linhaParaConfig(clinicaId, data ?? null);
}

export type SalvarSlaConfigInput = {
  ativo: boolean;
  primeiraRespostaMinutos: number;
  respostaAtendimentoMinutos: number;
  alertaPercentual: number;
  considerarApenasHorarioUtil: boolean;
};

export function validarSlaConfig(input: SalvarSlaConfigInput): string | null {
  if (!Number.isInteger(input.primeiraRespostaMinutos) || input.primeiraRespostaMinutos <= 0) return "primeira_resposta_invalida";
  if (!Number.isInteger(input.respostaAtendimentoMinutos) || input.respostaAtendimentoMinutos <= 0) return "resposta_atendimento_invalida";
  if (!Number.isInteger(input.alertaPercentual) || input.alertaPercentual <= 0 || input.alertaPercentual > 100) return "alerta_invalido";
  return null;
}

export async function salvarSlaConfig(clinicaId: string, input: SalvarSlaConfigInput): Promise<{ ok: boolean; error?: string }> {
  const erro = validarSlaConfig(input);
  if (erro) return { ok: false, error: erro };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { error } = await supabase.from("sla_config").upsert(
    {
      clinica_id: clinicaId,
      ativo: input.ativo,
      primeira_resposta_minutos: input.primeiraRespostaMinutos,
      resposta_atendimento_minutos: input.respostaAtendimentoMinutos,
      alerta_percentual: input.alertaPercentual,
      considerar_apenas_horario_util: input.considerarApenasHorarioUtil,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinica_id" }
  );

  if (error) {
    console.error("[sla] salvar_config_failed", JSON.stringify({ code: error.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }
  return { ok: true };
}

export type CicloAberto = { mensagemId: string; inicioEm: string; tipo: TipoCicloSla };

/**
 * Deriva o ciclo de espera atual a partir de `mensagens` — sem tabela de
 * ciclos: início = 1ª `recebida` depois da última `enviada` humana (ou desde
 * sempre, se nunca houve resposta humana nesta conversa); várias mensagens
 * seguidas do paciente contam como 1 ciclo só (a mais antiga marca o
 * início). `conversas.status` já é a fonte de "tem ciclo aberto" — respondido/
 * agendado/perdido (STATUS_RESOLVIDOS) = sem ciclo, mesmo critério que
 * finalizarAtendimento usa (src/lib/chat.ts) — reaproveita o funil que já
 * existe em vez de inventar um estado novo.
 */
export async function buscarCicloAberto(clinicaId: string, conversaId: string, statusConhecido?: StatusConversa): Promise<CicloAberto | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  // `statusConhecido`: quem já leu a conversa (o verificador de alertas) evita a consulta repetida.
  let status = statusConhecido;
  if (!status) {
    const { data: conversa } = await supabase.from("conversas").select("status").eq("id", conversaId).eq("clinica_id", clinicaId).maybeSingle();
    if (!conversa) return null;
    status = conversa.status as StatusConversa;
  }
  if (STATUS_RESOLVIDOS.includes(status)) return null;

  const { data: ultimaRespostaHumana } = await supabase
    .from("mensagens")
    .select("id, created_at")
    .eq("conversa_id", conversaId)
    .eq("direcao", "enviada")
    .not("enviada_por_atendente_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let query = supabase.from("mensagens").select("id, created_at").eq("conversa_id", conversaId).eq("direcao", "recebida");
  if (ultimaRespostaHumana) query = query.gt("created_at", ultimaRespostaHumana.created_at as string);

  const { data: primeiraRecebidaDoCiclo } = await query.order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!primeiraRecebidaDoCiclo) return null;

  return {
    mensagemId: primeiraRecebidaDoCiclo.id as string,
    inicioEm: primeiraRecebidaDoCiclo.created_at as string,
    tipo: ultimaRespostaHumana ? "resposta_atendimento" : "primeira_resposta",
  };
}

export function minutosEntre(inicio: Date, fim: Date, horario: ConfiguracaoHorario | null, respeitaHorario: boolean): number {
  if (!respeitaHorario || !horario) return Math.max(0, Math.floor((fim.getTime() - inicio.getTime()) / 60000));
  const resultado = calcularMinutosUteisAtendimento(inicio, fim, horario);
  return resultado.ok ? resultado.minutos : 0;
}

/**
 * Núcleo do status a partir de um ciclo já conhecido — ÚNICO cálculo de SLA
 * (a tela do Chat, o resumo e o verificador de alertas passam por aqui; nenhum
 * outro lugar recalcula minutos úteis).
 */
export function statusSlaDoCiclo(config: SlaConfig, horario: ConfiguracaoHorario | null, ciclo: CicloAberto, agora: Date): StatusSlaConversa {
  const limiteMinutos = ciclo.tipo === "primeira_resposta" ? config.primeiraRespostaMinutos : config.respostaAtendimentoMinutos;
  const minutosConsumidos = minutosEntre(new Date(ciclo.inicioEm), agora, horario, config.considerarApenasHorarioUtil);
  const dentroDoHorarioAgora = horario ? avaliarHorarioAtendimento(horario, agora).dentro : true;
  const nivel = avaliarStatusPorMinutos(minutosConsumidos, limiteMinutos, config.alertaPercentual, dentroDoHorarioAgora, config.considerarApenasHorarioUtil);
  const percentual = limiteMinutos > 0 ? Math.round((minutosConsumidos / limiteMinutos) * 100) : 100;

  return {
    tipo: nivel,
    cicloTipo: ciclo.tipo,
    cicloMensagemId: ciclo.mensagemId,
    cicloInicioEm: ciclo.inicioEm,
    limiteMinutos,
    minutosConsumidos,
    percentual,
  };
}

export type ContextoSla = { config: SlaConfig; horario: ConfiguracaoHorario | null; horarioConfigurado: boolean };

/** Config do SLA + horário, lidos UMA vez (o verificador avalia várias conversas com o mesmo contexto). */
export async function carregarContextoSla(clinicaId: string): Promise<ContextoSla> {
  const [config, horario] = await Promise.all([buscarSlaConfig(clinicaId), buscarConfiguracaoHorario(clinicaId)]);
  return { config, horario, horarioConfigurado: Boolean(horario && horario.periodos.length > 0) };
}

/** `not_configured` cobre: SLA desligado, ou (só quando `considerarApenasHorarioUtil`) horário de atendimento ainda não configurado — nunca finge 24x7 pra produzir métrica falsa. */
export async function avaliarStatusSlaConversa(clinicaId: string, conversaId: string, agora: Date): Promise<StatusSlaConversa> {
  const config = await buscarSlaConfig(clinicaId);
  if (!config.ativo) return { tipo: "not_configured" };

  const horario = config.considerarApenasHorarioUtil ? await buscarConfiguracaoHorario(clinicaId) : null;
  if (config.considerarApenasHorarioUtil && (!horario || horario.periodos.length === 0)) return { tipo: "not_configured" };

  const ciclo = await buscarCicloAberto(clinicaId, conversaId);
  if (!ciclo) return { tipo: "sem_ciclo" };

  return statusSlaDoCiclo(config, horario, ciclo, agora);
}

/**
 * Idempotente por `unique(conversa_id, mensagem_id, tipo)` — mesmo padrão já
 * usado 3x no projeto (insert + tratar 23505 como sucesso). Chamado de fora
 * (nunca de dentro de avaliarStatusSlaConversa) pra não esconder escrita
 * dentro do que parece só leitura — ver rota da API. `atendente_responsavel_id`
 * vem de `conversas.atribuido_a` (quem é dono da conversa), NUNCA de quem
 * disparou a consulta que descobriu o breach — são coisas diferentes.
 */
export async function registrarSlaBreachSeNovo(clinicaId: string, conversaId: string, status: StatusSlaConversa): Promise<void> {
  if (status.tipo !== "breached") return;

  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { data: conversa } = await supabase.from("conversas").select("atribuido_a").eq("id", conversaId).eq("clinica_id", clinicaId).maybeSingle();

  const { error } = await supabase.from("sla_eventos").insert({
    clinica_id: clinicaId,
    conversa_id: conversaId,
    mensagem_id: status.cicloMensagemId,
    tipo: status.cicloTipo,
    limite_minutos: status.limiteMinutos,
    minutos_consumidos: status.minutosConsumidos,
    atendente_responsavel_id: (conversa?.atribuido_a as string | null) ?? null,
  });

  if (error && error.code !== "23505") {
    console.error("[sla] registrar_evento_failed", JSON.stringify({ code: error.code ?? null }));
  }
}

export type ItemStatusSlaLista = {
  conversaId: string;
  telefone: string;
  pacienteNome: string | null;
  atribuidoAId: string | null;
  status: StatusSlaConversa;
};

/**
 * Só conversas com ciclo potencial (`novo`/`aguardando` — o resto já cai em
 * `sem_ciclo` por definição). Conjunto naturalmente pequeno numa caixa
 * compartilhada (não é "todo histórico"), então N consultas pequenas por
 * conversa (mesmo custo de avaliarStatusSlaConversa) é aceitável — ver
 * relatório, seção performance.
 */
export async function buscarStatusSlaLista(clinicaId: string, agora: Date): Promise<ItemStatusSlaLista[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data: conversas } = await supabase
    .from("conversas")
    .select("id, telefone, atribuido_a, pacientes(nome)")
    .eq("clinica_id", clinicaId)
    .in("status", ["novo", "aguardando"]);

  if (!conversas || conversas.length === 0) return [];

  const resultados = await Promise.all(
    conversas.map(async (c) => ({
      conversaId: c.id as string,
      telefone: c.telefone as string,
      pacienteNome: (Array.isArray(c.pacientes) ? c.pacientes[0]?.nome : (c.pacientes as { nome?: string } | null)?.nome) ?? null,
      atribuidoAId: c.atribuido_a as string | null,
      status: await avaliarStatusSlaConversa(clinicaId, c.id as string, agora),
    }))
  );

  return resultados;
}

export type MetricaPrimeiraRespostaHumana = { mediaMinutos: number | null; medianaMinutos: number | null; amostras: number };

/**
 * Histórico (não é o status ao vivo): conversas do período com pelo menos 1
 * resposta humana, minutos úteis entre a 1ª mensagem recebida e a 1ª
 * resposta humana. Mesmo padrão de campanha-metricas.ts/relatorios.ts:
 * busca bruta + cálculo em JS, sem agregação em SQL.
 */
export async function calcularMetricaPrimeiraRespostaHumana(
  clinicaId: string,
  intervalo: { inicio: Date; fim: Date }
): Promise<MetricaPrimeiraRespostaHumana> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { mediaMinutos: null, medianaMinutos: null, amostras: 0 };

  const config = await buscarSlaConfig(clinicaId);
  const horario = config.considerarApenasHorarioUtil ? await buscarConfiguracaoHorario(clinicaId) : null;

  // Mesmo gate de avaliarStatusSlaConversa: sem horário configurado, não dá
  // pra medir minutos úteis — 0 amostras/null é a resposta honesta, nunca
  // "0 min" (que pareceria "respostas instantâneas", uma métrica falsa).
  if (config.considerarApenasHorarioUtil && (!horario || horario.periodos.length === 0)) {
    return { mediaMinutos: null, medianaMinutos: null, amostras: 0 };
  }

  const { data: conversas } = await supabase
    .from("conversas")
    .select("id")
    .eq("clinica_id", clinicaId)
    .gte("created_at", intervalo.inicio.toISOString())
    .lte("created_at", intervalo.fim.toISOString());

  if (!conversas || conversas.length === 0) return { mediaMinutos: null, medianaMinutos: null, amostras: 0 };

  const minutosPorConversa = await Promise.all(
    conversas.map(async (c) => {
      const { data: primeiraRecebida } = await supabase
        .from("mensagens")
        .select("created_at")
        .eq("conversa_id", c.id as string)
        .eq("direcao", "recebida")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!primeiraRecebida) return null;

      const { data: primeiraRespostaHumana } = await supabase
        .from("mensagens")
        .select("created_at")
        .eq("conversa_id", c.id as string)
        .eq("direcao", "enviada")
        .not("enviada_por_atendente_id", "is", null)
        .gte("created_at", primeiraRecebida.created_at as string)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!primeiraRespostaHumana) return null;

      return minutosEntre(new Date(primeiraRecebida.created_at as string), new Date(primeiraRespostaHumana.created_at as string), horario, config.considerarApenasHorarioUtil);
    })
  );

  const validos = minutosPorConversa.filter((m): m is number => m !== null);
  if (validos.length === 0) return { mediaMinutos: null, medianaMinutos: null, amostras: 0 };

  const media = Math.round(validos.reduce((soma, v) => soma + v, 0) / validos.length);
  return { mediaMinutos: media, medianaMinutos: mediana(validos), amostras: validos.length };
}

export type ResumoSlaHoje = {
  ativo: boolean;
  dentro: number;
  proximosDoLimite: number;
  foraDoSla: number;
  pausados: number;
  primeiraRespostaMediaMinutos: number | null;
  taxaDentroPercentual: number | null;
};

/** "SLA Hoje" (item 24) — composição das duas buscas acima, sem tabela/cálculo novo. */
export async function buscarResumoSlaHoje(clinicaId: string, agora: Date): Promise<ResumoSlaHoje> {
  const config = await buscarSlaConfig(clinicaId);
  if (!config.ativo) {
    return { ativo: false, dentro: 0, proximosDoLimite: 0, foraDoSla: 0, pausados: 0, primeiraRespostaMediaMinutos: null, taxaDentroPercentual: null };
  }

  const inicioHoje = new Date(agora);
  inicioHoje.setUTCHours(0, 0, 0, 0);

  const [lista, metrica] = await Promise.all([
    buscarStatusSlaLista(clinicaId, agora),
    calcularMetricaPrimeiraRespostaHumana(clinicaId, { inicio: inicioHoje, fim: agora }),
  ]);

  const comCiclo = lista.filter((i) => i.status.tipo !== "not_configured" && i.status.tipo !== "sem_ciclo");
  const dentro = comCiclo.filter((i) => i.status.tipo === "ok").length;
  const proximosDoLimite = comCiclo.filter((i) => i.status.tipo === "warning").length;
  const foraDoSla = comCiclo.filter((i) => i.status.tipo === "breached").length;
  const pausados = comCiclo.filter((i) => i.status.tipo === "paused").length;
  const totalAvaliavel = dentro + proximosDoLimite + foraDoSla;

  return {
    ativo: true,
    dentro,
    proximosDoLimite,
    foraDoSla,
    pausados,
    primeiraRespostaMediaMinutos: metrica.mediaMinutos,
    taxaDentroPercentual: totalAvaliavel > 0 ? Math.round((dentro / totalAvaliavel) * 100) : null,
  };
}
