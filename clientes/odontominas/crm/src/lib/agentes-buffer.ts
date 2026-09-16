import { getSupabaseServerClient } from "@/lib/supabase";
import { buscarAgente, responderComoAgente } from "@/lib/agentes";

/**
 * Agentes de IA — Fase 2B (Buffer de mensagens). Se o paciente manda várias
 * mensagens seguidas no WhatsApp, o agente espera um tempo depois da última
 * antes de responder tudo de uma vez, em vez de responder mensagem por
 * mensagem. Arquitetura aprovada em `_memoria/decisoes.md`: debounce por
 * coluna em `conversas` (sobrevive a restart do processo, ao contrário de um
 * timer em memória) + um poll dentro do próprio processo Next
 * (`iniciarPollBuffer`, chamado por `src/instrumentation.ts` — sem
 * cron/serviço novo, o Railway já roda um container Node persistente).
 *
 * Opt-in por agente (`agente.bufferMensagens`, desligado por padrão): sem
 * buffer ligado, `processarMensagemRecebida` chama `responderComoAgente`
 * direto, comportamento idêntico a antes desta fase.
 *
 * Import é sempre agentes-buffer.ts -> agentes.ts, nunca o contrário (evita
 * import circular).
 */

const INTERVALO_POLL_MS = 3000;

/** Junta os textos de uma rajada de mensagens numa resposta só — pura, sem I/O. */
export function juntarMensagensBuffer(textos: string[]): string {
  return textos
    .map((t) => t.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Abre (1ª mensagem da rajada) ou estende (mensagem seguinte, ainda dentro da
 * janela) o buffer da conversa. `agente_buffer_desde` só é gravado na
 * abertura — marca o início da rajada atual, usado depois pra saber quais
 * mensagens entram na resposta combinada.
 */
async function abrirOuEstenderBuffer(
  clinicaId: string,
  conversaId: string,
  bufferSegundos: number,
  isNovoPaciente: boolean
): Promise<{ ok: boolean }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false };

  const { data: atual } = await supabase
    .from("conversas")
    .select("agente_buffer_desde")
    .eq("id", conversaId)
    .maybeSingle();

  const agora = new Date();
  const ate = new Date(agora.getTime() + bufferSegundos * 1000).toISOString();

  const { error } = await supabase
    .from("conversas")
    .update({
      agente_buffer_ate: ate,
      ...(atual?.agente_buffer_desde ? {} : { agente_buffer_desde: agora.toISOString() }),
      ...(isNovoPaciente ? { agente_buffer_novo_paciente: true } : {}),
    })
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId);

  if (error) {
    console.error("[agentes-buffer] abrir_estender_failed", JSON.stringify({ conversaId, code: error.code ?? null }));
    return { ok: false };
  }
  return { ok: true };
}

/**
 * Chamada pelo webhook no lugar de `responderComoAgente` direto. Sem buffer
 * ligado no agente, responde na hora (comportamento de sempre). Com buffer
 * ligado, só abre/estende a janela — quem responde de fato é o poll, quando
 * a janela vencer.
 */
export async function processarMensagemRecebida(
  clinicaId: string,
  conversaId: string,
  agenteAtivoId: string,
  mensagemRecebida: string,
  isNovoPaciente: boolean
): Promise<{ ok: boolean; error?: string }> {
  const agente = await buscarAgente(clinicaId, agenteAtivoId);
  if (!agente || !agente.ativo) return { ok: false, error: "agente_inativo" };

  if (!agente.bufferMensagens) {
    return responderComoAgente(clinicaId, conversaId, mensagemRecebida, isNovoPaciente);
  }

  return abrirOuEstenderBuffer(clinicaId, conversaId, agente.bufferSegundos, isNovoPaciente);
}

/**
 * Chamada pelo poll (`ciclo`, abaixo). Varre conversas com janela vencida,
 * fecha cada uma (antes de ler as mensagens — assim uma mensagem que chegar
 * durante o processamento abre uma janela NOVA em vez de ficar perdida),
 * junta o que o paciente mandou na rajada e chama `responderComoAgente`
 * DIRETO — nunca `processarMensagemRecebida`, que reabriria o buffer de novo
 * (o agente continua com `bufferMensagens: true`) em vez de responder.
 */
export async function processarBuffersVencidos(): Promise<{ processados: number }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { processados: 0 };

  const agora = new Date().toISOString();
  const { data: vencidos, error } = await supabase
    .from("conversas")
    .select("id, clinica_id, agente_ativo_id, agente_buffer_desde, agente_buffer_novo_paciente")
    .not("agente_buffer_ate", "is", null)
    .lte("agente_buffer_ate", agora);

  if (error) {
    console.error("[agentes-buffer] listar_vencidos_failed", JSON.stringify({ code: error.code ?? null }));
    return { processados: 0 };
  }
  if (!vencidos || vencidos.length === 0) return { processados: 0 };

  let processados = 0;
  for (const conversa of vencidos) {
    const conversaId = conversa.id as string;
    const desde = conversa.agente_buffer_desde as string | null;
    const agenteAtivoId = conversa.agente_ativo_id as string | null;
    const isNovoPaciente = Boolean(conversa.agente_buffer_novo_paciente);
    const fechadaEm = new Date().toISOString();

    await supabase
      .from("conversas")
      .update({ agente_buffer_desde: null, agente_buffer_ate: null, agente_buffer_novo_paciente: false })
      .eq("id", conversaId);

    // Sem desde ou sem agente ativo (humano assumiu no meio da espera, ex.:
    // "Pausar IA" no Chat ao Vivo): nada a responder, a janela só fica fechada.
    if (!desde || !agenteAtivoId) continue;

    const { data: mensagens } = await supabase
      .from("mensagens")
      .select("conteudo")
      .eq("conversa_id", conversaId)
      .eq("direcao", "recebida")
      .not("conteudo", "is", null)
      .gte("created_at", desde)
      .lte("created_at", fechadaEm)
      .order("created_at", { ascending: true });

    const textoCombinado = juntarMensagensBuffer((mensagens ?? []).map((m) => m.conteudo as string));
    if (!textoCombinado) continue;

    const resultado = await responderComoAgente(
      conversa.clinica_id as string,
      conversaId,
      textoCombinado,
      isNovoPaciente
    );
    if (resultado.ok) {
      processados++;
    } else {
      console.error("[agentes-buffer] responder_failed", JSON.stringify({ conversaId, error: resultado.error ?? null }));
    }
  }

  return { processados };
}

let cicloAgendado = false;

async function ciclo(): Promise<void> {
  try {
    await processarBuffersVencidos();
  } catch (e) {
    console.error("[agentes-buffer] ciclo_falhou", JSON.stringify({ message: (e as Error).message }));
  } finally {
    // setTimeout recursivo, nunca setInterval: garante que uma iteração
    // termina antes da próxima começar (zero sobreposição), mesmo se uma
    // rodada demorar mais que INTERVALO_POLL_MS.
    setTimeout(ciclo, INTERVALO_POLL_MS);
  }
}

/** Chamada uma vez por `src/instrumentation.ts` quando o processo sobe (produção). Idempotente. */
export function iniciarPollBuffer(): void {
  if (cicloAgendado) return;
  cicloAgendado = true;
  console.log("[agentes-buffer] poll iniciado");
  ciclo();
}
