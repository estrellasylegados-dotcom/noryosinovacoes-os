import { getSupabaseServerClient } from "@/lib/supabase";
import { isStatusValido, type StatusConversa } from "@/lib/status";

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
};

export type FichaPaciente = {
  id: string;
  nome: string | null;
  telefone: string;
  email: string | null;
  criadoEm: string;
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
    .select("id, nome, telefone, email, created_at")
    .eq("id", pacienteId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();

  if (erroPaciente || !paciente) return null;

  const { data: conversaRow } = await supabase
    .from("conversas")
    .select("id, status, aguardando_desde, ultima_mensagem_em")
    .eq("paciente_id", pacienteId)
    .eq("clinica_id", clinicaId)
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
        .select("status_anterior, status_novo, created_at")
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
    }));
  }

  return {
    id: paciente.id as string,
    nome: paciente.nome as string | null,
    telefone: paciente.telefone as string,
    email: paciente.email as string | null,
    criadoEm: paciente.created_at as string,
    conversa,
    mensagens,
    eventos,
  };
}
