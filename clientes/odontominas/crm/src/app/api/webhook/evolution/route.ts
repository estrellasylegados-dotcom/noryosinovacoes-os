import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getClinicaId } from "@/lib/clinica";
import { extractMensagem, isGroupOrBroadcast, normalizeTelefone } from "@/lib/evolution-webhook";
import { decidirTransicaoWebhook } from "@/lib/funil";
import { isStatusValido } from "@/lib/status";
import { deveResponder, responderComoAgente } from "@/lib/agentes";

/**
 * Fase 2 do CRM (espelhamento): recebe o evento `messages.upsert` da
 * Evolution API e grava em `conversas`/`mensagens`. Conversa/paciente são
 * achados-ou-criados por (clinica_id, telefone) — uma conversa por paciente,
 * reaberta em vez de duplicada quando ele escreve de novo depois de
 * resolvida. Regra de transição de status em src/lib/funil.ts.
 *
 * Autenticação: a Evolution API ecoa a própria apikey da instância no corpo
 * do payload (`body.apikey`) — comparamos com EVOLUTION_API_KEY em vez de
 * depender de header custom, que a Evolution não garante enviar.
 */

export const runtime = "nodejs";

type EvolutionWebhookBody = {
  event?: string;
  instance?: string;
  apikey?: string;
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string };
    pushName?: string;
    message?: Record<string, unknown>;
    messageType?: string;
    messageTimestamp?: number | string;
  };
};

type PgError = { code?: string; message?: string } | null;

function logErr(step: string, error: PgError) {
  console.error(
    "[webhook/evolution]",
    JSON.stringify({ step, code: error?.code ?? null, message: (error?.message ?? "").slice(0, 200) || null })
  );
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  let body: EvolutionWebhookBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // A Evolution API ecoa o TOKEN DA INSTÂNCIA no campo apikey do payload
  // (não a chave global usada pra chamar a API dela) — validado empiricamente
  // batendo os dois valores contra o payload real.
  const validKeys = [process.env.EVOLUTION_API_KEY, process.env.EVOLUTION_INSTANCE_TOKEN].filter(Boolean);
  if (validKeys.length === 0 || !validKeys.includes(body.apikey)) {
    console.error("[webhook/evolution] unauthorized", JSON.stringify({ instance: body.instance ?? null }));
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const event = (body.event || "").toLowerCase();
  if (event !== "messages.upsert") {
    return NextResponse.json({ ok: true, skipped: "event_not_handled" });
  }

  const data = body.data;
  const remoteJid = data?.key?.remoteJid;
  if (!data || !remoteJid) {
    return NextResponse.json({ ok: false, error: "missing_key" }, { status: 400 });
  }

  if (isGroupOrBroadcast(remoteJid)) {
    return NextResponse.json({ ok: true, skipped: "group_or_broadcast" });
  }

  const telefone = normalizeTelefone(remoteJid);
  if (!telefone) {
    return NextResponse.json({ ok: false, error: "invalid_remote_jid" }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const clinicaId = await getClinicaId();
  if (!supabase || !clinicaId) {
    console.error(
      "[webhook/evolution] backend_unavailable",
      JSON.stringify({ supabase: Boolean(supabase), clinicaId: Boolean(clinicaId) })
    );
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  const fromMe = data.key?.fromMe === true;
  const direcao = fromMe ? "enviada" : "recebida";
  const { tipo, conteudo } = extractMensagem(data.message, data.messageType);
  const messageId = data.key?.id ?? null;
  // pushName em mensagem enviada é o nome da conta conectada, não do paciente.
  const pushName = !fromMe ? data.pushName || null : null;
  const tsRaw = data.messageTimestamp;
  const tsSeconds = tsRaw ? (typeof tsRaw === "string" ? parseInt(tsRaw, 10) : tsRaw) : null;
  const timestampWhatsapp = tsSeconds ? new Date(tsSeconds * 1000).toISOString() : new Date().toISOString();

  const { data: pacienteExistente } = await supabase
    .from("pacientes")
    .select("id, nome")
    .eq("clinica_id", clinicaId)
    .eq("telefone", telefone)
    .maybeSingle();

  let pacienteId: string | null = pacienteExistente?.id ?? null;
  if (!pacienteId) {
    const { data: novoPaciente, error: pacienteError } = await supabase
      .from("pacientes")
      .insert({ clinica_id: clinicaId, telefone, nome: pushName })
      .select("id")
      .single();
    if (pacienteError || !novoPaciente) {
      logErr("insert:pacientes", pacienteError);
      return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 503 });
    }
    pacienteId = novoPaciente.id as string;
  } else if (pushName && !pacienteExistente?.nome) {
    await supabase
      .from("pacientes")
      .update({ nome: pushName, updated_at: new Date().toISOString() })
      .eq("id", pacienteId);
  }

  const { data: conversaExistente } = await supabase
    .from("conversas")
    .select("id, status, mensagens_nao_lidas")
    .eq("clinica_id", clinicaId)
    .eq("telefone", telefone)
    .maybeSingle();

  let conversaId: string | null = conversaExistente?.id ?? null;
  let statusAnterior: string | null = null;
  let statusNovo: string | null = null;
  let motivoEvento: string | null = null;

  if (!conversaId) {
    const status = fromMe ? "respondido" : "novo";
    const { data: novaConversa, error: conversaError } = await supabase
      .from("conversas")
      .insert({
        clinica_id: clinicaId,
        paciente_id: pacienteId,
        telefone,
        instancia_evolution: body.instance ?? null,
        remote_jid: remoteJid,
        status,
        primeira_mensagem_em: timestampWhatsapp,
        ultima_mensagem_em: timestampWhatsapp,
        aguardando_desde: timestampWhatsapp,
        nao_lida: !fromMe,
        mensagens_nao_lidas: fromMe ? 0 : 1,
      })
      .select("id")
      .single();
    if (conversaError || !novaConversa) {
      logErr("insert:conversas", conversaError);
      return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 503 });
    }
    conversaId = novaConversa.id as string;
  } else {
    const statusBruto = conversaExistente!.status as string;
    const statusAtual = isStatusValido(statusBruto) ? statusBruto : "novo";
    const decisao = decidirTransicaoWebhook(statusAtual, fromMe);
    const contadorAtual = (conversaExistente!.mensagens_nao_lidas as number | null) ?? 0;

    await supabase
      .from("conversas")
      .update({
        ultima_mensagem_em: timestampWhatsapp,
        updated_at: new Date().toISOString(),
        status: decisao.statusNovo,
        paciente_id: pacienteId,
        // fromMe: a própria clínica respondeu (painel, app oficial ou automação) — já
        // está "vista" por definição, zera o contador. !fromMe: o paciente escreveu,
        // soma mais 1 — só volta a zero quando alguém abre a conversa no Chat ao Vivo
        // ou responde por lá (src/lib/chat.ts).
        nao_lida: !fromMe,
        mensagens_nao_lidas: fromMe ? 0 : contadorAtual + 1,
        // reabriu = mensagem nova numa conversa já resolvida: reinicia o
        // relógio de "tempo até 1ª resposta" a partir desta mensagem, não
        // do contato original (que pode ter sido dias/semanas atrás).
        ...(decisao.reabriu ? { aguardando_desde: timestampWhatsapp } : {}),
      })
      .eq("id", conversaId);

    if (decisao.evento) {
      statusAnterior = decisao.evento.statusAnterior;
      statusNovo = decisao.evento.statusNovo;
      motivoEvento = decisao.evento.motivo;
    }
  }

  if (statusAnterior && statusNovo && motivoEvento) {
    await supabase.from("eventos_funil").insert({
      clinica_id: clinicaId,
      conversa_id: conversaId,
      status_anterior: statusAnterior,
      status_novo: statusNovo,
      motivo: motivoEvento,
    });
  }

  const { error: mensagemError } = await supabase.from("mensagens").insert({
    clinica_id: clinicaId,
    conversa_id: conversaId,
    direcao,
    tipo,
    conteudo,
    remote_jid: remoteJid,
    evolution_message_id: messageId,
    timestamp_whatsapp: timestampWhatsapp,
    raw: data,
  });

  if (mensagemError) {
    // unique(evolution_message_id): reenvio do mesmo evento não é erro, é idempotência.
    if (mensagemError.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    logErr("insert:mensagens", mensagemError);
    return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 503 });
  }

  // Agente de IA: nunca pode derrubar o ack do webhook pra Evolution — roda
  // isolado, depois que a mensagem já está persistida. Uma falha/demora da
  // IA só fica no log; a conversa segue visível no Chat ao Vivo normalmente.
  if (direcao === "recebida" && conteudo) {
    try {
      const { data: conversaAgente } = await supabase
        .from("conversas")
        .select("agente_ativo_id, agente_pausado_ate")
        .eq("id", conversaId)
        .maybeSingle();

      const deveIaResponder = deveResponder(
        {
          agenteAtivoId: (conversaAgente?.agente_ativo_id as string | null) ?? null,
          agentePausadoAte: (conversaAgente?.agente_pausado_ate as string | null) ?? null,
        },
        new Date(),
        false
      );

      if (deveIaResponder) {
        const resultado = await responderComoAgente(clinicaId, conversaId as string, conteudo, !pacienteExistente);
        if (!resultado.ok) {
          console.error("[webhook/evolution] agente_ia_failed", JSON.stringify({ conversaId, error: resultado.error ?? null }));
        }
      }
    } catch (e) {
      console.error("[webhook/evolution] agente_ia_error", JSON.stringify({ conversaId, message: (e as Error).message }));
    }
  }

  return NextResponse.json({ ok: true });
}
