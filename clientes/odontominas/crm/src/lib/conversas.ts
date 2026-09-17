import { getSupabaseServerClient } from "@/lib/supabase";
import { isStatusValido, STATUS_RESOLVIDOS, type StatusConversa } from "@/lib/status";
import { buscarAgente } from "@/lib/agentes";
import { dispararPixelSeConfigurado } from "@/lib/agentes-pixel";
import { registrarEventoCampanha } from "@/lib/campanha-eventos";

export type ConversaPainel = {
  id: string;
  telefone: string;
  pacienteId: string | null;
  pacienteNome: string | null;
  status: StatusConversa;
  aguardandoDesde: string | null;
  ultimaMensagemEm: string | null;
  /**
   * null = sem ciclo em aberto registrado, ou conversa que nunca chegou a
   * ser respondida de fato (ex.: marcada "perdido" direto a partir de
   * "novo" — não é honesto chamar isso de "respondeu em Xmin").
   * Enquanto `novo`/`aguardando`: tempo esperando (em aberto, recalculado a cada carga).
   * Depois de responder de verdade: tempo que levou até a 1ª resposta do ciclo atual (fixo).
   */
  tempoPrimeiraRespostaMs: number | null;
  /**
   * Quem marcou "respondido" manualmente no ciclo atual (atendente_id de
   * eventos_funil) — null quando a resposta foi automática (webhook, sem
   * pessoa por trás) ou quando ainda não há resposta. Alimenta src/lib/equipe.ts.
   */
  atendidoPorId: string | null;
};

const PRIORIDADE: Record<StatusConversa, number> = {
  novo: 0,
  aguardando: 1,
  respondido: 2,
  agendado: 3,
  perdido: 4,
};

/** Formato de uma relação embutida `select("...(nome)")` do Supabase — usado pra paciente e, na ficha, pra atendente. */
export type NomeEmbutido = { nome: string | null } | { nome: string | null }[] | null;

export function extrairNomeEmbutido(embutido: NomeEmbutido): string | null {
  if (!embutido) return null;
  return Array.isArray(embutido) ? (embutido[0]?.nome ?? null) : embutido.nome;
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
    .select("id, telefone, status, aguardando_desde, ultima_mensagem_em, paciente_id, pacientes(nome)")
    .eq("clinica_id", clinicaId);

  if (filtroStatus && isStatusValido(filtroStatus)) {
    query = query.eq("status", filtroStatus);
  }

  const { data: conversas, error } = await query;
  if (error || !conversas) {
    console.error("[conversas] listar_failed", JSON.stringify({ code: error?.code ?? null }));
    return [];
  }

  // Primeira resposta = 1º evento_funil que leva a conversa a "respondido" de
  // verdade (não qualquer saída de "novo" — sair pra "perdido" direto não é
  // resposta, é desistência, e não deve aparecer como "respondeu em Xmin").
  const ids = conversas.map((c) => c.id as string);
  const respostasPorConversa = new Map<string, string>();
  const atendentePorConversa = new Map<string, string | null>();
  if (ids.length > 0) {
    const { data: eventos } = await supabase
      .from("eventos_funil")
      .select("conversa_id, created_at, atendente_id")
      .eq("clinica_id", clinicaId)
      .eq("status_novo", "respondido")
      .in("conversa_id", ids)
      .order("created_at", { ascending: true });

    for (const evento of eventos ?? []) {
      const conversaId = evento.conversa_id as string;
      if (!respostasPorConversa.has(conversaId)) {
        respostasPorConversa.set(conversaId, evento.created_at as string);
        atendentePorConversa.set(conversaId, (evento.atendente_id as string | null) ?? null);
      }
    }
  }

  const agora = Date.now();
  const resultado: ConversaPainel[] = conversas.map((c) => {
    const statusBruto = c.status as string;
    const status = isStatusValido(statusBruto) ? statusBruto : "novo";
    const aguardandoDesde = c.aguardando_desde as string | null;
    const respondidaEm = respostasPorConversa.get(c.id as string) ?? null;

    let tempoPrimeiraRespostaMs: number | null = null;
    let atendidoPorId: string | null = null;
    if (aguardandoDesde) {
      const inicioCiclo = new Date(aguardandoDesde).getTime();
      // Reabrir zera `aguardando_desde`: uma resposta de um ciclo anterior
      // (antes da reabertura) nunca deve contar pro ciclo atual.
      const respostaDoCicloAtual =
        respondidaEm && new Date(respondidaEm).getTime() >= inicioCiclo ? respondidaEm : null;

      if (respostaDoCicloAtual) {
        tempoPrimeiraRespostaMs = new Date(respostaDoCicloAtual).getTime() - inicioCiclo;
        atendidoPorId = atendentePorConversa.get(c.id as string) ?? null;
      } else if (status === "novo" || status === "aguardando") {
        tempoPrimeiraRespostaMs = agora - inicioCiclo;
      }
    }

    return {
      id: c.id as string,
      telefone: c.telefone as string,
      pacienteId: (c.paciente_id as string | null | undefined) ?? null,
      pacienteNome: extrairNomeEmbutido(c.pacientes as NomeEmbutido),
      status,
      aguardandoDesde,
      ultimaMensagemEm: c.ultima_mensagem_em as string | null,
      tempoPrimeiraRespostaMs,
      atendidoPorId,
    };
  });

  resultado.sort((a, b) => {
    const prioridadeDiff = PRIORIDADE[a.status] - PRIORIDADE[b.status];
    if (prioridadeDiff !== 0) return prioridadeDiff;

    if (a.status === "novo" || a.status === "aguardando") {
      // Dentro de quem espera resposta: quem espera há mais tempo primeiro.
      return new Date(a.aguardandoDesde ?? 0).getTime() - new Date(b.aguardandoDesde ?? 0).getTime();
    }
    return new Date(b.ultimaMensagemEm ?? 0).getTime() - new Date(a.ultimaMensagemEm ?? 0).getTime();
  });

  return resultado;
}

/**
 * Fase 3 (gatilhos temporais/eventos internos — ver _memoria/decisoes.md):
 * acha a conversa do paciente pra iniciar uma execução de automação que não
 * nasceu de uma mensagem recebida (aniversário, evento interno). "Path B"
 * (ver clinica.ts) garante 1 conversa por paciente, nunca duas — mesma
 * premissa já usada em `buscarFichaPaciente` (pacientes.ts). Se o paciente
 * nunca teve conversa (ex.: importado sem nunca ter escrito), cria uma nova
 * no mesmo formato do webhook pra uma mensagem "de nós pra ele"
 * (`status='respondido'`, sem badge de não-lida — não é o paciente esperando
 * resposta, somos nós que estamos iniciando contato).
 */
export async function obterOuCriarConversaDoPaciente(clinicaId: string, pacienteId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data: existente } = await supabase
    .from("conversas")
    .select("id")
    .eq("clinica_id", clinicaId)
    .eq("paciente_id", pacienteId)
    .maybeSingle();
  if (existente) return existente.id as string;

  const { data: paciente } = await supabase.from("pacientes").select("telefone").eq("id", pacienteId).eq("clinica_id", clinicaId).maybeSingle();
  const telefone = (paciente?.telefone as string | null) ?? null;
  if (!telefone) return null;

  const agora = new Date().toISOString();
  const { data: nova, error } = await supabase
    .from("conversas")
    .insert({
      clinica_id: clinicaId,
      paciente_id: pacienteId,
      telefone,
      status: "respondido",
      primeira_mensagem_em: agora,
      ultima_mensagem_em: agora,
      aguardando_desde: agora,
      nao_lida: false,
      mensagens_nao_lidas: 0,
    })
    .select("id")
    .single();

  if (error || !nova) {
    // 23505 (unique clinica_id+telefone): outra automação/webhook criou entre o SELECT e este INSERT — busca de novo, não é erro real.
    if (error?.code === "23505") {
      const { data: corrida } = await supabase.from("conversas").select("id").eq("clinica_id", clinicaId).eq("telefone", telefone).maybeSingle();
      return (corrida?.id as string | null) ?? null;
    }
    console.error("[conversas] obter_ou_criar_failed", JSON.stringify({ pacienteId, code: error?.code ?? null }));
    return null;
  }
  return nova.id as string;
}

export async function atualizarStatus(
  clinicaId: string,
  conversaId: string,
  statusNovo: StatusConversa,
  atendenteId: string | null = null
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data: atual, error: erroAtual } = await supabase
    .from("conversas")
    .select("status, telefone, ultimo_agente_id, paciente_id")
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();

  if (erroAtual || !atual) return { ok: false, error: "not_found" };

  const statusAnterior = atual.status as string;
  if (statusAnterior === statusNovo) return { ok: true };

  // Atendente reabrindo manualmente uma conversa já resolvida: reinicia o
  // relógio de espera a partir de agora, senão "tempo até 1ª resposta"
  // volta a contar desde o contato original (pode ser dias atrás).
  const reabreCiclo =
    statusNovo === "novo" && isStatusValido(statusAnterior) && STATUS_RESOLVIDOS.includes(statusAnterior);
  const agora = new Date().toISOString();

  const { error: erroUpdate } = await supabase
    .from("conversas")
    .update({
      status: statusNovo,
      updated_at: agora,
      ...(reabreCiclo ? { aguardando_desde: agora } : {}),
    })
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId);

  if (erroUpdate) return { ok: false, error: "update_failed" };

  await supabase.from("eventos_funil").insert({
    clinica_id: clinicaId,
    conversa_id: conversaId,
    status_anterior: statusAnterior,
    status_novo: statusNovo,
    motivo: "manual",
    atendente_id: atendenteId,
  });

  // Pixel de Conversão: "Agendado" é a conversão principal (Facebook + Google
  // Ads) — busca o agente que já foi dono desta conversa (ultimo_agente_id
  // sobrevive ao agente_ativo_id zerar quando o fluxo conclui) pra achar a
  // config de Pixel dele. Isolado: nunca pode derrubar a troca de status.
  const ultimoAgenteId = atual.ultimo_agente_id as string | null;
  if (statusNovo === "agendado" && ultimoAgenteId) {
    try {
      const agente = await buscarAgente(clinicaId, ultimoAgenteId);
      if (agente) {
        await dispararPixelSeConfigurado(agente, "agendado", clinicaId, conversaId, atual.telefone as string);
      }
    } catch (e) {
      console.error("[conversas] pixel_agendado_failed", JSON.stringify({ conversaId, message: (e as Error).message }));
    }
  }

  // Campanhas: se o paciente desta conversa tem origem por campanha, o
  // agendamento vira o marco `appointment_booked` do funil (idempotente —
  // só a 1ª vez conta, mesmo que o status oscile entre agendado/outro).
  const pacienteId = atual.paciente_id as string | null;
  if (statusNovo === "agendado" && pacienteId) {
    try {
      const { data: paciente } = await supabase.from("pacientes").select("campanha_id").eq("id", pacienteId).maybeSingle();
      const campanhaId = (paciente?.campanha_id as string | null) ?? null;
      if (campanhaId) {
        await registrarEventoCampanha(clinicaId, campanhaId, "appointment_booked", { pacienteId, conversaId });
      }
    } catch (e) {
      console.error("[conversas] evento_campanha_agendado_failed", JSON.stringify({ conversaId, message: (e as Error).message }));
    }
  }

  return { ok: true };
}
