import { getSupabaseServerClient } from "@/lib/supabase";
import { isStatusValido, type StatusConversa } from "@/lib/status";

export type ConversaPainel = {
  id: string;
  telefone: string;
  pacienteNome: string | null;
  status: StatusConversa;
  primeiraMensagemEm: string | null;
  ultimaMensagemEm: string | null;
  /**
   * null = sem primeira mensagem registrada.
   * Enquanto `novo`/`aguardando`: tempo esperando (em aberto, recalculado a cada carga).
   * Depois de responder: tempo que levou até a 1ª resposta (fixo).
   */
  tempoPrimeiraRespostaMs: number | null;
};

const PRIORIDADE: Record<StatusConversa, number> = {
  novo: 0,
  aguardando: 1,
  respondido: 2,
  agendado: 3,
  perdido: 4,
};

type PacienteEmbutido = { nome: string | null } | { nome: string | null }[] | null;

function extrairNomePaciente(pacientes: PacienteEmbutido): string | null {
  if (!pacientes) return null;
  return Array.isArray(pacientes) ? (pacientes[0]?.nome ?? null) : pacientes.nome;
}

export async function contarPorStatus(clinicaId: string): Promise<Record<StatusConversa, number>> {
  const base: Record<StatusConversa, number> = {
    novo: 0,
    aguardando: 0,
    respondido: 0,
    agendado: 0,
    perdido: 0,
  };

  const supabase = getSupabaseServerClient();
  if (!supabase) return base;

  const { data, error } = await supabase.from("conversas").select("status").eq("clinica_id", clinicaId);
  if (error || !data) return base;

  for (const row of data) {
    const status = row.status as string;
    if (isStatusValido(status)) base[status]++;
  }
  return base;
}

export async function listarConversas(clinicaId: string, filtroStatus?: string): Promise<ConversaPainel[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("conversas")
    .select("id, telefone, status, primeira_mensagem_em, ultima_mensagem_em, pacientes(nome)")
    .eq("clinica_id", clinicaId);

  if (filtroStatus && isStatusValido(filtroStatus)) {
    query = query.eq("status", filtroStatus);
  }

  const { data: conversas, error } = await query;
  if (error || !conversas) {
    console.error("[conversas] listar_failed", JSON.stringify({ code: error?.code ?? null }));
    return [];
  }

  // Primeira resposta = 1º evento_funil que tira a conversa de "novo" (log gravado
  // tanto pelo avanço automático do webhook quanto por troca manual no painel).
  const ids = conversas.map((c) => c.id as string);
  const primeiraRespostaPorConversa = new Map<string, string>();
  if (ids.length > 0) {
    const { data: eventos } = await supabase
      .from("eventos_funil")
      .select("conversa_id, created_at")
      .eq("clinica_id", clinicaId)
      .eq("status_anterior", "novo")
      .in("conversa_id", ids)
      .order("created_at", { ascending: true });

    for (const evento of eventos ?? []) {
      const conversaId = evento.conversa_id as string;
      if (!primeiraRespostaPorConversa.has(conversaId)) {
        primeiraRespostaPorConversa.set(conversaId, evento.created_at as string);
      }
    }
  }

  const agora = Date.now();
  const resultado: ConversaPainel[] = conversas.map((c) => {
    const statusBruto = c.status as string;
    const status = isStatusValido(statusBruto) ? statusBruto : "novo";
    const primeiraMensagemEm = c.primeira_mensagem_em as string | null;
    const respondidaEm = primeiraRespostaPorConversa.get(c.id as string) ?? null;

    let tempoPrimeiraRespostaMs: number | null = null;
    if (primeiraMensagemEm) {
      if (respondidaEm) {
        tempoPrimeiraRespostaMs = new Date(respondidaEm).getTime() - new Date(primeiraMensagemEm).getTime();
      } else if (status === "novo" || status === "aguardando") {
        tempoPrimeiraRespostaMs = agora - new Date(primeiraMensagemEm).getTime();
      }
    }

    return {
      id: c.id as string,
      telefone: c.telefone as string,
      pacienteNome: extrairNomePaciente(c.pacientes as PacienteEmbutido),
      status,
      primeiraMensagemEm,
      ultimaMensagemEm: c.ultima_mensagem_em as string | null,
      tempoPrimeiraRespostaMs,
    };
  });

  resultado.sort((a, b) => {
    const prioridadeDiff = PRIORIDADE[a.status] - PRIORIDADE[b.status];
    if (prioridadeDiff !== 0) return prioridadeDiff;

    if (a.status === "novo" || a.status === "aguardando") {
      // Dentro de quem espera resposta: quem espera há mais tempo primeiro.
      return new Date(a.primeiraMensagemEm ?? 0).getTime() - new Date(b.primeiraMensagemEm ?? 0).getTime();
    }
    return new Date(b.ultimaMensagemEm ?? 0).getTime() - new Date(a.ultimaMensagemEm ?? 0).getTime();
  });

  return resultado;
}

export async function atualizarStatus(
  clinicaId: string,
  conversaId: string,
  statusNovo: StatusConversa
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data: atual, error: erroAtual } = await supabase
    .from("conversas")
    .select("status")
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();

  if (erroAtual || !atual) return { ok: false, error: "not_found" };

  const statusAnterior = atual.status as string;
  if (statusAnterior === statusNovo) return { ok: true };

  const { error: erroUpdate } = await supabase
    .from("conversas")
    .update({ status: statusNovo, updated_at: new Date().toISOString() })
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId);

  if (erroUpdate) return { ok: false, error: "update_failed" };

  await supabase.from("eventos_funil").insert({
    clinica_id: clinicaId,
    conversa_id: conversaId,
    status_anterior: statusAnterior,
    status_novo: statusNovo,
    motivo: "manual",
  });

  return { ok: true };
}
