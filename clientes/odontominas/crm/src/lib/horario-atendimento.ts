import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Fundação reutilizável pro SLA futuro (tempo de primeira resposta, alertas
 * de atraso, filas, automações, Agente de IA, indicadores — ver andamento.md
 * da fatia "Horário de Atendimento"). Esta lib NÃO conecta em nada disso
 * ainda, só define a configuração e as duas funções de domínio pedidas.
 *
 * Núcleo puro (avaliarHorarioAtendimento/calcularProximoHorario/validação) é
 * testado direto, sem Supabase — mesmo critério do resto do projeto
 * (campanha-metricas.ts, nps.ts: "núcleo puro + busca separada").
 */

export type PeriodoAtendimento = {
  /** 0=domingo .. 6=sábado (Date.prototype.getDay()). */
  diaSemana: number;
  /** "HH:MM", 24h. */
  horaInicio: string;
  horaFim: string;
};

export type ConfiguracaoHorario = {
  /** IANA, ex. "America/Sao_Paulo". Escalar por clínica — não varia por dia. */
  timezone: string;
  periodos: PeriodoAtendimento[];
};

export type ResultadoHorario =
  | { dentro: true; motivo: "sem_configuracao" }
  | { dentro: true; motivo: "dentro_periodo" }
  | { dentro: false; motivo: "dia_fechado" }
  | { dentro: false; motivo: "fora_periodo" };

const DIAS_SEMANA_CURTOS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HORA_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function paraMinutos(horaMinuto: string): number {
  const [h, m] = horaMinuto.split(":").map(Number);
  return h * 60 + m;
}

/** Dia da semana e minutos-desde-meia-noite de um instante, na hora local do timezone dado (cobre horário de verão via Intl, sem tabela fixa). */
function partesLocais(timestamp: Date, timezone: string): { diaSemana: number; ano: number; mes: number; dia: number; minutosDoDia: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(timestamp).map((x) => [x.type, x.value])) as Record<string, string>;
  return {
    diaSemana: DIAS_SEMANA_CURTOS.indexOf(p.weekday),
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.dia ?? p.day),
    minutosDoDia: Number(p.hour) * 60 + Number(p.minute),
  };
}

/** Offset do timezone (minutos, UTC-para-local) no instante dado — positivo a leste de UTC. */
function offsetMinutos(timestamp: Date, timezone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(timestamp).map((x) => [x.type, x.value])) as Record<string, string>;
  const comoUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return Math.round((comoUtc - timestamp.getTime()) / 60000);
}

/** Constrói o instante (UTC) correspondente a uma data+hora "de parede" num timezone — técnica padrão de 2 passos (palpite + correção pelo offset real), sem depender de biblioteca de timezone. */
function construirInstanteNoTimezone(ano: number, mes: number, dia: number, horaMinuto: string, timezone: string): Date {
  const [hora, minuto] = horaMinuto.split(":").map(Number);
  const palpiteUtc = Date.UTC(ano, mes - 1, dia, hora, minuto);
  const offset = offsetMinutos(new Date(palpiteUtc), timezone);
  return new Date(palpiteUtc - offset * 60000);
}

/**
 * `config.periodos` vazio (clínica nunca configurada) → sempre dentro do
 * horário: decisão deliberada — como nada no sistema hoje lê esta função
 * ainda, isso garante que nenhum comportamento futuro (SLA, automação) fique
 * silenciosamente "fechado" só porque a clínica ainda não configurou nada.
 * Dia sem período (configurado como fechado, ex. domingo) é um caso
 * diferente e retorna fechado normalmente.
 */
export function avaliarHorarioAtendimento(config: ConfiguracaoHorario, timestamp: Date): ResultadoHorario {
  if (config.periodos.length === 0) return { dentro: true, motivo: "sem_configuracao" };

  const { diaSemana, minutosDoDia } = partesLocais(timestamp, config.timezone);
  const periodosDoDia = config.periodos.filter((p) => p.diaSemana === diaSemana);
  if (periodosDoDia.length === 0) return { dentro: false, motivo: "dia_fechado" };

  const dentro = periodosDoDia.some((p) => minutosDoDia >= paraMinutos(p.horaInicio) && minutosDoDia < paraMinutos(p.horaFim));
  return dentro ? { dentro: true, motivo: "dentro_periodo" } : { dentro: false, motivo: "fora_periodo" };
}

/**
 * Próximo instante em que o atendimento ABRE, estritamente depois de
 * `timestamp` (se já está dentro de um período agora, pula pro próximo —
 * nunca devolve "agora"). `null` quando não há nenhum período configurado em
 * nenhum dia (nada pra calcular) ou nenhum período em 8 dias (config só com
 * dias fechados).
 */
export function calcularProximoHorario(config: ConfiguracaoHorario, timestamp: Date): Date | null {
  if (config.periodos.length === 0) return null;

  const atual = partesLocais(timestamp, config.timezone);
  const diaBaseUtc = Date.UTC(atual.ano, atual.mes - 1, atual.dia);

  for (let deslocamentoDias = 0; deslocamentoDias <= 7; deslocamentoDias++) {
    const diaCandidato = (atual.diaSemana + deslocamentoDias) % 7;
    const periodosDoDia = [...config.periodos]
      .filter((p) => p.diaSemana === diaCandidato)
      .sort((a, b) => paraMinutos(a.horaInicio) - paraMinutos(b.horaInicio));

    for (const periodo of periodosDoDia) {
      const ehHoje = deslocamentoDias === 0;
      if (ehHoje && paraMinutos(periodo.horaInicio) <= atual.minutosDoDia) continue;

      const alvoUtc = new Date(diaBaseUtc + deslocamentoDias * 24 * 60 * 60 * 1000);
      return construirInstanteNoTimezone(alvoUtc.getUTCFullYear(), alvoUtc.getUTCMonth() + 1, alvoUtc.getUTCDate(), periodo.horaInicio, config.timezone);
    }
  }

  return null;
}

export function timezoneValido(tz: string): boolean {
  if (!tz) return false;
  try {
    // Só valida que o timezone existe (o formatter em si é descartado).
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export type PayloadHorario = { timezone: string; periodos: PeriodoAtendimento[] };

/** Pura, sem I/O — testável direto. */
export function validarConfiguracaoHorario(payload: PayloadHorario): string | null {
  if (!timezoneValido(payload.timezone)) return "timezone_invalido";

  for (const p of payload.periodos) {
    if (!Number.isInteger(p.diaSemana) || p.diaSemana < 0 || p.diaSemana > 6) return "dia_semana_invalido";
    if (!HORA_REGEX.test(p.horaInicio) || !HORA_REGEX.test(p.horaFim)) return "horario_invalido";
    if (paraMinutos(p.horaInicio) >= paraMinutos(p.horaFim)) return "horario_inicio_maior_que_fim";
  }

  const porDia = new Map<number, PeriodoAtendimento[]>();
  for (const p of payload.periodos) {
    if (!porDia.has(p.diaSemana)) porDia.set(p.diaSemana, []);
    porDia.get(p.diaSemana)!.push(p);
  }
  for (const periodosDoDia of porDia.values()) {
    const ordenados = [...periodosDoDia].sort((a, b) => paraMinutos(a.horaInicio) - paraMinutos(b.horaInicio));
    for (let i = 1; i < ordenados.length; i++) {
      if (paraMinutos(ordenados[i].horaInicio) < paraMinutos(ordenados[i - 1].horaFim)) return "periodos_sobrepostos";
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// I/O — busca/persiste no Supabase. Sem teste direto (mesmo critério do
// resto do projeto: disparos-worker.ts, criarAgente/atualizarAgente).
// ---------------------------------------------------------------------------

/** `null` só quando a clínica não existe ou o backend está fora do ar — clínica existente sem período nenhum volta `{ periodos: [] }`, não `null`. */
export async function buscarConfiguracaoHorario(clinicaId: string): Promise<ConfiguracaoHorario | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data: clinica } = await supabase.from("clinicas").select("timezone").eq("id", clinicaId).maybeSingle();
  if (!clinica) return null;

  const { data, error } = await supabase
    .from("horario_atendimento_periodos")
    .select("dia_semana, hora_inicio, hora_fim")
    .eq("clinica_id", clinicaId)
    .order("dia_semana", { ascending: true })
    .order("hora_inicio", { ascending: true });

  if (error) {
    console.error("[horario-atendimento] buscar_failed", JSON.stringify({ code: error.code ?? null }));
    return { timezone: clinica.timezone as string, periodos: [] };
  }

  return {
    timezone: clinica.timezone as string,
    periodos: (data ?? []).map((p) => ({
      diaSemana: p.dia_semana as number,
      horaInicio: (p.hora_inicio as string).slice(0, 5),
      horaFim: (p.hora_fim as string).slice(0, 5),
    })),
  };
}

/** Nunca bloqueia por engano: clínica não encontrada/backend fora do ar volta "sem_configuracao" (dentro), não lança e não some com dado. */
export async function isDentroHorarioAtendimento(clinicaId: string, timestamp: Date): Promise<ResultadoHorario> {
  const config = await buscarConfiguracaoHorario(clinicaId);
  if (!config) return { dentro: true, motivo: "sem_configuracao" };
  return avaliarHorarioAtendimento(config, timestamp);
}

export async function proximoHorarioAtendimento(clinicaId: string, timestamp: Date): Promise<Date | null> {
  const config = await buscarConfiguracaoHorario(clinicaId);
  if (!config) return null;
  return calcularProximoHorario(config, timestamp);
}

/**
 * Substitui a configuração inteira (timezone + todos os períodos) numa
 * chamada — mais simples e seguro que diff incremental pra uma tabela
 * pequena (no máximo poucas dezenas de linhas por clínica). Não é
 * transacional entre apagar e inserir (este projeto não usa função de banco/
 * RPC); risco aceito dado ser config administrativa de baixa frequência,
 * nunca concorrente — registrado no relatório da fatia.
 */
export async function salvarConfiguracaoHorario(clinicaId: string, payload: PayloadHorario): Promise<{ ok: boolean; error?: string }> {
  const erro = validarConfiguracaoHorario(payload);
  if (erro) return { ok: false, error: erro };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { error: erroTimezone } = await supabase.from("clinicas").update({ timezone: payload.timezone }).eq("id", clinicaId);
  if (erroTimezone) {
    console.error("[horario-atendimento] salvar_timezone_failed", JSON.stringify({ code: erroTimezone.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  const { error: erroDelete } = await supabase.from("horario_atendimento_periodos").delete().eq("clinica_id", clinicaId);
  if (erroDelete) {
    console.error("[horario-atendimento] limpar_periodos_failed", JSON.stringify({ code: erroDelete.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  if (payload.periodos.length > 0) {
    const { error: erroInsert } = await supabase.from("horario_atendimento_periodos").insert(
      payload.periodos.map((p) => ({
        clinica_id: clinicaId,
        dia_semana: p.diaSemana,
        hora_inicio: p.horaInicio,
        hora_fim: p.horaFim,
      }))
    );
    if (erroInsert) {
      console.error("[horario-atendimento] inserir_periodos_failed", JSON.stringify({ code: erroInsert.code ?? null }));
      return { ok: false, error: "persist_failed" };
    }
  }

  return { ok: true };
}
