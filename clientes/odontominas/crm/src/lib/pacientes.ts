import { getSupabaseServerClient } from "@/lib/supabase";
import { extrairNomeEmbutido, type NomeEmbutido } from "@/lib/conversas";
import { isStatusValido, type StatusConversa } from "@/lib/status";
import { registrarEventoCampanha } from "@/lib/campanha-eventos";

export type MensagemFicha = {
  id: string;
  direcao: "recebida" | "enviada";
  tipo: string;
  conteudo: string | null;
  quando: string;
};

export type EventoFicha = {
  statusAnterior: string | null;
  statusNovo: string;
  quando: string;
  /** Quem fez a troca manual no painel — null quando foi automática (webhook). */
  atendenteNome: string | null;
};

export type FichaPaciente = {
  id: string;
  nome: string | null;
  telefone: string;
  email: string | null;
  criadoEm: string;
  campanhaId: string | null;
  /** `date` (YYYY-MM-DD) ou null — Fase 3, ver _memoria/decisoes.md. Nunca preenchido com dado falso. */
  dataNascimento: string | null;
  conversa: {
    id: string;
    status: StatusConversa;
    aguardandoDesde: string | null;
    ultimaMensagemEm: string | null;
  } | null;
  mensagens: MensagemFicha[];
  eventos: EventoFicha[];
};

/**
 * Telefone é único por clínica em `pacientes` e em `conversas` — path B
 * (ver andamento.md) garante 1 conversa por paciente, nunca duas em aberto
 * ao mesmo tempo. Por isso a ficha busca a conversa por `paciente_id` sem
 * precisar decidir entre várias.
 */
export async function buscarFichaPaciente(clinicaId: string, pacienteId: string): Promise<FichaPaciente | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data: paciente, error: erroPaciente } = await supabase
    .from("pacientes")
    .select("id, nome, telefone, email, created_at, campanha_id, data_nascimento")
    .eq("id", pacienteId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();

  if (erroPaciente || !paciente) return null;

  const { data: conversaRow } = await supabase
    .from("conversas")
    .select("id, status, aguardando_desde, ultima_mensagem_em")
    .eq("paciente_id", pacienteId)
    .eq("clinica_id", clinicaId)
    // Paciente em 2+ canais tem 2+ conversas: a ficha mostra a mais recente.
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const conversa = conversaRow
    ? {
        id: conversaRow.id as string,
        status: (isStatusValido(conversaRow.status as string) ? conversaRow.status : "novo") as StatusConversa,
        aguardandoDesde: conversaRow.aguardando_desde as string | null,
        ultimaMensagemEm: conversaRow.ultima_mensagem_em as string | null,
      }
    : null;

  let mensagens: MensagemFicha[] = [];
  let eventos: EventoFicha[] = [];

  if (conversa) {
    const [{ data: mensagensRows }, { data: eventosRows }] = await Promise.all([
      supabase
        .from("mensagens")
        .select("id, direcao, tipo, conteudo, timestamp_whatsapp, created_at")
        .eq("conversa_id", conversa.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("eventos_funil")
        .select("status_anterior, status_novo, created_at, atendentes(nome)")
        .eq("conversa_id", conversa.id)
        .order("created_at", { ascending: true }),
    ]);

    mensagens = (mensagensRows ?? []).map((m) => ({
      id: m.id as string,
      direcao: m.direcao as "recebida" | "enviada",
      tipo: m.tipo as string,
      conteudo: m.conteudo as string | null,
      quando: (m.timestamp_whatsapp as string | null) ?? (m.created_at as string),
    }));

    eventos = (eventosRows ?? []).map((e) => ({
      statusAnterior: e.status_anterior as string | null,
      statusNovo: e.status_novo as string,
      quando: e.created_at as string,
      atendenteNome: extrairNomeEmbutido(e.atendentes as NomeEmbutido),
    }));
  }

  return {
    id: paciente.id as string,
    nome: paciente.nome as string | null,
    telefone: paciente.telefone as string,
    email: paciente.email as string | null,
    criadoEm: paciente.created_at as string,
    campanhaId: (paciente.campanha_id as string | null) ?? null,
    dataNascimento: (paciente.data_nascimento as string | null) ?? null,
    conversa,
    mensagens,
    eventos,
  };
}

export type PacienteResumo = { id: string; nome: string | null; telefone: string };

/** Leads de uma campanha — alimenta o seletor de "Registrar comparecimento/fechamento" no painel dela. */
export async function listarPacientesDaCampanha(clinicaId: string, campanhaId: string): Promise<PacienteResumo[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("pacientes")
    .select("id, nome, telefone")
    .eq("clinica_id", clinicaId)
    .eq("campanha_id", campanhaId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((p) => ({ id: p.id as string, nome: (p.nome as string | null) ?? null, telefone: p.telefone as string }));
}

/**
 * Vínculo manual paciente↔campanha (item 14 do briefing) — a Evolution API
 * (Baileys, WhatsApp não-oficial) não entrega UTM/`ctwa_clid` na mensagem
 * de entrada (achado da migração v14, Pixel de Conversão), então a origem
 * por campanha nasce de uma escolha manual no painel, não de detecção
 * automática. Dispara o evento `new_lead` na 1ª vez que a campanha é
 * definida (idempotente — ver registrarEventoCampanha).
 */
export async function vincularCampanhaPaciente(
  clinicaId: string,
  pacienteId: string,
  campanhaId: string | null
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { error } = await supabase
    .from("pacientes")
    .update({ campanha_id: campanhaId })
    .eq("id", pacienteId)
    .eq("clinica_id", clinicaId);

  if (error) return { ok: false, error: "persist_failed" };

  if (campanhaId) {
    try {
      await registrarEventoCampanha(clinicaId, campanhaId, "new_lead", { pacienteId });
    } catch (e) {
      console.error("[pacientes] registrar_new_lead_failed", JSON.stringify({ pacienteId, message: (e as Error).message }));
    }
  }

  return { ok: true };
}

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fase 3 — edição direta na ficha (src/components/pacientes/
 * PacienteDataNascimento.tsx). `null` limpa o campo (paciente sem data
 * cadastrada ainda é estado válido, nunca obrigatório). Nunca aceita data no
 * futuro — não tem como nascer amanhã.
 */
export async function atualizarDataNascimento(
  clinicaId: string,
  pacienteId: string,
  dataNascimento: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (dataNascimento !== null) {
    if (!FORMATO_DATA.test(dataNascimento)) return { ok: false, error: "formato_invalido" };
    if (new Date(dataNascimento).getTime() > Date.now()) return { ok: false, error: "data_futura" };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { error } = await supabase
    .from("pacientes")
    .update({ data_nascimento: dataNascimento, updated_at: new Date().toISOString() })
    .eq("id", pacienteId)
    .eq("clinica_id", clinicaId);

  if (error) return { ok: false, error: "persist_failed" };
  return { ok: true };
}
