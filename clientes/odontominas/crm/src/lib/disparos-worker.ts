import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getClinicaId } from "@/lib/clinica";
import { adquirirLock, liberarLock } from "@/lib/disparos-lock";
import { enviarPeloCanalPrincipal } from "@/lib/canais-envio";
import { resolverVariaveis } from "@/lib/mensagens-salvas";
import { normalizarTelefoneEntrada } from "@/lib/chat";
import { intervaloEnvioMs, type StatusDestinatario } from "@/lib/disparos";

/**
 * Disparos — Fase B: worker de envio in-process. Mesmo desenho de
 * `agentes-buffer.ts` (setTimeout recursivo, nunca setInterval — garante zero
 * sobreposição de ciclo mesmo se um envio demorar) porque o Railway já roda
 * um container Node persistente, e GitHub Actions (cron do ControleODONTO)
 * tem granularidade de minutos — não serve pro intervalo de 15-25s entre
 * mensagens que o WhatsApp via Evolution exige pra não levar shadowban.
 *
 * Só o ciclo que efetivamente manda uma mensagem paga o intervalo cheio
 * (`intervaloEnvioMs`); pular destinatário (opt-out/telefone inválido
 * reconferido ao vivo) ou fechar um disparo esgotado agenda o próximo tick
 * rápido, porque não usou o número de WhatsApp.
 *
 * Tabelas renomeadas na v18 (2026-09-16): `campanhas`→`disparos`,
 * `campanha_destinatarios`→`disparo_destinatarios` — liberou "campanha" pro
 * módulo estratégico novo (src/lib/campanhas.ts). Lógica de envio idêntica.
 */

const RESOURCE = "envio";
const LOCK_TTL_MS = 60_000;
const POLL_OCIOSO_MS = 5_000;
const POLL_OCUPADO_MS = 3_000;
const POLL_IMEDIATO_MS = 500;

async function buscarProximoDisparoEnviando(
  supabase: SupabaseClient,
  clinicaId: string
): Promise<{ id: string; mensagemTexto: string } | null> {
  const { data } = await supabase
    .from("disparos")
    .select("id, mensagem_texto")
    .eq("clinica_id", clinicaId)
    .eq("status", "enviando")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id as string, mensagemTexto: data.mensagem_texto as string };
}

async function incrementarContador(
  supabase: SupabaseClient,
  disparoId: string,
  campo: "total_enviados" | "total_falhas" | "total_pulados"
): Promise<void> {
  const { data } = await supabase.from("disparos").select(campo).eq("id", disparoId).maybeSingle();
  const atual = ((data as Record<string, number | null> | null)?.[campo] as number | null) ?? 0;
  await supabase
    .from("disparos")
    .update({ [campo]: atual + 1, updated_at: new Date().toISOString() })
    .eq("id", disparoId);
}

async function marcarConcluido(supabase: SupabaseClient, disparoId: string): Promise<void> {
  const agora = new Date().toISOString();
  await supabase.from("disparos").update({ status: "concluida", concluido_em: agora, updated_at: agora }).eq("id", disparoId);
}

async function marcarDestinatario(
  supabase: SupabaseClient,
  destinatarioId: string,
  status: StatusDestinatario,
  extra?: Record<string, unknown>
): Promise<void> {
  await supabase
    .from("disparo_destinatarios")
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq("id", destinatarioId);
}

let cicloAgendado = false;

async function ciclo(): Promise<void> {
  let holder: string | null = null;
  let clinicaComLock: string | null = null;
  let proximoDelayMs = POLL_OCIOSO_MS;

  try {
    const clinicaId = await getClinicaId();
    if (!clinicaId) return;

    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    const lock = await adquirirLock(clinicaId, RESOURCE, LOCK_TTL_MS);
    if (!lock.ok || !lock.holder) {
      proximoDelayMs = POLL_OCUPADO_MS;
      return;
    }
    holder = lock.holder;
    clinicaComLock = clinicaId;

    const disparo = await buscarProximoDisparoEnviando(supabase, clinicaId);
    if (!disparo) {
      proximoDelayMs = POLL_OCIOSO_MS;
      return;
    }

    const { data: destinatario } = await supabase
      .from("disparo_destinatarios")
      .select("id, paciente_id, conversa_id, telefone, nome")
      .eq("disparo_id", disparo.id)
      .eq("status", "pendente")
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!destinatario) {
      await marcarConcluido(supabase, disparo.id);
      proximoDelayMs = POLL_IMEDIATO_MS;
      return;
    }

    // Reconfere opt-out/telefone AO VIVO — o snapshot é de quando o disparo
    // foi criado, e ele pode levar horas pra terminar de enviar.
    const { data: paciente } = await supabase
      .from("pacientes")
      .select("opt_out_em, telefone")
      .eq("id", destinatario.paciente_id as string)
      .maybeSingle();

    const telefoneValido = paciente?.telefone ? normalizarTelefoneEntrada(paciente.telefone as string) : null;
    const optOutEm = (paciente?.opt_out_em as string | null) ?? null;

    if (optOutEm || !telefoneValido) {
      const status: StatusDestinatario = optOutEm ? "pulado_opt_out" : "telefone_invalido";
      await marcarDestinatario(supabase, destinatario.id as string, status);
      await incrementarContador(supabase, disparo.id, "total_pulados");
      proximoDelayMs = POLL_IMEDIATO_MS;
      return;
    }

    const texto = resolverVariaveis(disparo.mensagemTexto, {
      nome: destinatario.nome as string | null,
      telefone: destinatario.telefone as string,
    });
    const envio = await enviarPeloCanalPrincipal(clinicaId, telefoneValido, texto);
    const agora = new Date().toISOString();

    if (envio.ok) {
      await marcarDestinatario(supabase, destinatario.id as string, "enviado", {
        enviado_em: agora,
        evolution_message_id: envio.mensagemId ?? null,
      });
      await incrementarContador(supabase, disparo.id, "total_enviados");

      const conversaId = destinatario.conversa_id as string | null;
      if (conversaId) {
        await supabase.from("conversas").update({ ultima_mensagem_em: agora, updated_at: agora }).eq("id", conversaId);

        const { error: erroMensagem } = await supabase.from("mensagens").insert({
          clinica_id: clinicaId,
          conversa_id: conversaId,
          direcao: "enviada",
          tipo: "texto",
          conteudo: texto,
          evolution_message_id: envio.mensagemId ?? null,
          timestamp_whatsapp: agora,
        });
        // unique(evolution_message_id): mesma idempotência de reativacao.ts/chat.ts.
        if (erroMensagem && erroMensagem.code !== "23505") {
          console.error(
            "[disparos-worker] insert_mensagem_failed",
            JSON.stringify({ conversaId, code: erroMensagem.code ?? null })
          );
        }
      }
    } else {
      await marcarDestinatario(supabase, destinatario.id as string, "falha", { erro: envio.error ?? null });
      await incrementarContador(supabase, disparo.id, "total_falhas");
      console.error(
        "[disparos-worker] envio_failed",
        JSON.stringify({ disparoId: disparo.id, destinatarioId: destinatario.id, error: envio.error ?? null })
      );
    }

    proximoDelayMs = intervaloEnvioMs();
  } catch (e) {
    console.error("[disparos-worker] ciclo_falhou", JSON.stringify({ message: (e as Error).message }));
  } finally {
    if (holder && clinicaComLock) await liberarLock(clinicaComLock, RESOURCE, holder);
    setTimeout(ciclo, proximoDelayMs);
  }
}

/** Chamada uma vez por `src/instrumentation.ts` quando o processo sobe (produção). Idempotente. */
export function iniciarWorkerDisparos(): void {
  if (cicloAgendado) return;
  cicloAgendado = true;
  console.log("[disparos-worker] iniciado");
  ciclo();
}
