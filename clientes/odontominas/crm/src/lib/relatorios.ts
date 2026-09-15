import { getSupabaseServerClient } from "@/lib/supabase";
import { STATUS_RESOLVIDOS } from "@/lib/status";
import { inicioDoDiaBrasilia } from "@/lib/tempo";

/**
 * Relatórios de atendimento (2026-09-15, a pedido do Rafael, painel estilo
 * RoiZap "Relatórios > Atendimentos"): agregados por período, separados dos
 * agregados "agora" que já existem em src/lib/resumo.ts (tempo médio até 1ª
 * resposta, taxa de resolução) — esses continuam sobre o funil inteiro, não
 * fica um segundo cálculo divergente do mesmo número. O que é novo aqui é só
 * o que depende de uma janela de tempo: novos pacientes, mensagens,
 * conversas tocadas e as séries dos gráficos (por dia, por hora).
 *
 * Sem CSAT (pesquisa de satisfação não existe no sistema), sem "Instâncias"
 * (1 clínica = 1 número de WhatsApp) nem "Análise IA" — não fabricar seção
 * pra funcionalidade que não existe.
 */

export type PeriodoRelatorio = "hoje" | "7d" | "15d" | "30d" | "90d";

export const PERIODO_ORDEM: PeriodoRelatorio[] = ["hoje", "7d", "15d", "30d", "90d"];

export const PERIODO_CONFIG: Record<PeriodoRelatorio, { label: string; dias: number }> = {
  hoje: { label: "Hoje", dias: 1 },
  "7d": { label: "Últimos 7 dias", dias: 7 },
  "15d": { label: "Últimos 15 dias", dias: 15 },
  "30d": { label: "Últimos 30 dias", dias: 30 },
  "90d": { label: "Últimos 90 dias", dias: 90 },
};

export function isPeriodoValido(valor: string): valor is PeriodoRelatorio {
  return (PERIODO_ORDEM as string[]).includes(valor);
}

export function inicioPeriodo(periodo: PeriodoRelatorio, agora: Date): Date {
  const dias = PERIODO_CONFIG[periodo].dias;
  const inicioHoje = inicioDoDiaBrasilia(agora);
  return new Date(inicioHoje.getTime() - (dias - 1) * 24 * 60 * 60 * 1000);
}

/** Chave estável do dia (em Brasília) de um instante — mesmo instante do início do dia, como ISO. */
function chaveDiaBrasilia(iso: string): string {
  return inicioDoDiaBrasilia(new Date(iso)).toISOString();
}

/** Hora do dia (0-23) em Brasília — mesmo offset fixo (-3, sem horário de verão) de inicioDoDiaBrasilia. */
function horaBrasilia(iso: string): number {
  return (new Date(iso).getUTCHours() + 21) % 24; // (h - 3 + 24) % 24
}

export function diasDoPeriodo(inicio: Date, fim: Date): string[] {
  const dias: string[] = [];
  let cursor = inicioDoDiaBrasilia(inicio);
  const fimChave = inicioDoDiaBrasilia(fim);
  while (cursor.getTime() <= fimChave.getTime()) {
    dias.push(cursor.toISOString());
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return dias;
}

/** "dd/mm" em Brasília, pra rótulo de eixo. */
export function labelDia(chaveIso: string): string {
  return new Date(chaveIso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

export type PontoDia = { chave: string; label: string; novosPacientes: number; enviadas: number; recebidas: number; abertas: number; fechadas: number };
export type PontoHora = { label: string; enviadas: number; recebidas: number };

export function agruparPorDia(
  dias: string[],
  entradas: { quando: string; tipo: "paciente" | "enviada" | "recebida" | "aberta" | "fechada" }[]
): PontoDia[] {
  const base = new Map<string, PontoDia>(
    dias.map((chave) => [chave, { chave, label: labelDia(chave), novosPacientes: 0, enviadas: 0, recebidas: 0, abertas: 0, fechadas: 0 }])
  );

  for (const e of entradas) {
    const chave = chaveDiaBrasilia(e.quando);
    const ponto = base.get(chave);
    if (!ponto) continue; // fora da janela (pode acontecer por fuso na borda) — ignora em vez de estourar

    if (e.tipo === "paciente") ponto.novosPacientes++;
    else if (e.tipo === "enviada") ponto.enviadas++;
    else if (e.tipo === "recebida") ponto.recebidas++;
    else if (e.tipo === "aberta") ponto.abertas++;
    else if (e.tipo === "fechada") ponto.fechadas++;
  }

  return [...base.values()];
}

const BUCKETS_HORA = [0, 3, 6, 9, 12, 15, 18, 21];

export function agruparPorHora(entradas: { quando: string; direcao: "enviada" | "recebida" }[]): PontoHora[] {
  const base = new Map<number, PontoHora>(BUCKETS_HORA.map((h) => [h, { label: `${String(h).padStart(2, "0")}h`, enviadas: 0, recebidas: 0 }]));

  for (const e of entradas) {
    const hora = horaBrasilia(e.quando);
    const bucket = BUCKETS_HORA[Math.floor(hora / 3)];
    const ponto = base.get(bucket)!;
    if (e.direcao === "enviada") ponto.enviadas++;
    else ponto.recebidas++;
  }

  return BUCKETS_HORA.map((h) => base.get(h)!);
}

export type RelatorioAtendimento = {
  periodo: PeriodoRelatorio;
  novosPacientes: number;
  conversasTocadas: number;
  conversasAtivas: number;
  mensagensEnviadas: number;
  mensagensRecebidas: number;
  porDia: PontoDia[];
  porHora: PontoHora[];
};

export async function buscarRelatorioAtendimento(
  clinicaId: string,
  periodo: PeriodoRelatorio,
  agora: Date = new Date()
): Promise<RelatorioAtendimento> {
  const vazio: RelatorioAtendimento = {
    periodo,
    novosPacientes: 0,
    conversasTocadas: 0,
    conversasAtivas: 0,
    mensagensEnviadas: 0,
    mensagensRecebidas: 0,
    porDia: [],
    porHora: [],
  };

  const supabase = getSupabaseServerClient();
  if (!supabase) return vazio;

  const inicio = inicioPeriodo(periodo, agora).toISOString();
  const dias = diasDoPeriodo(inicioPeriodo(periodo, agora), agora);

  const [{ data: pacientes }, { data: mensagens }, { data: conversasNovas }, { data: eventosFechamento }] =
    await Promise.all([
      supabase.from("pacientes").select("created_at").eq("clinica_id", clinicaId).gte("created_at", inicio),
      supabase
        .from("mensagens")
        .select("conversa_id, direcao, timestamp_whatsapp, created_at")
        .eq("clinica_id", clinicaId)
        .gte("created_at", inicio),
      supabase
        .from("conversas")
        .select("primeira_mensagem_em, status")
        .eq("clinica_id", clinicaId)
        .gte("primeira_mensagem_em", inicio),
      supabase
        .from("eventos_funil")
        .select("created_at, status_novo")
        .eq("clinica_id", clinicaId)
        .gte("created_at", inicio)
        .in("status_novo", STATUS_RESOLVIDOS),
    ]);

  const mensagensRows = mensagens ?? [];
  const conversasTocadasIds = new Set(mensagensRows.map((m) => m.conversa_id as string));

  let conversasAtivas = 0;
  if (conversasTocadasIds.size > 0) {
    const { data: statusConversasTocadas } = await supabase
      .from("conversas")
      .select("status")
      .in("id", [...conversasTocadasIds]);
    conversasAtivas = (statusConversasTocadas ?? []).filter((c) => c.status !== "perdido").length;
  }

  const entradasDia: { quando: string; tipo: "paciente" | "enviada" | "recebida" | "aberta" | "fechada" }[] = [
    ...(pacientes ?? []).map((p) => ({ quando: p.created_at as string, tipo: "paciente" as const })),
    ...mensagensRows.map((m) => ({
      quando: (m.timestamp_whatsapp as string | null) ?? (m.created_at as string),
      tipo: m.direcao === "enviada" ? ("enviada" as const) : ("recebida" as const),
    })),
    ...(conversasNovas ?? []).map((c) => ({ quando: c.primeira_mensagem_em as string, tipo: "aberta" as const })),
    ...(eventosFechamento ?? []).map((e) => ({ quando: e.created_at as string, tipo: "fechada" as const })),
  ];

  return {
    periodo,
    novosPacientes: (pacientes ?? []).length,
    conversasTocadas: conversasTocadasIds.size,
    conversasAtivas,
    mensagensEnviadas: mensagensRows.filter((m) => m.direcao === "enviada").length,
    mensagensRecebidas: mensagensRows.filter((m) => m.direcao === "recebida").length,
    porDia: agruparPorDia(dias, entradasDia),
    porHora: agruparPorHora(
      mensagensRows.map((m) => ({
        quando: (m.timestamp_whatsapp as string | null) ?? (m.created_at as string),
        direcao: m.direcao === "enviada" ? "enviada" : "recebida",
      }))
    ),
  };
}

export type LeadDoPeriodo = { id: string; nome: string | null; telefone: string; criadoEm: string };

export async function listarNovosPacientes(
  clinicaId: string,
  periodo: PeriodoRelatorio,
  agora: Date = new Date()
): Promise<LeadDoPeriodo[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const inicio = inicioPeriodo(periodo, agora).toISOString();

  const { data, error } = await supabase
    .from("pacientes")
    .select("id, nome, telefone, created_at")
    .eq("clinica_id", clinicaId)
    .gte("created_at", inicio)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id as string,
    nome: p.nome as string | null,
    telefone: p.telefone as string,
    criadoEm: p.created_at as string,
  }));
}
