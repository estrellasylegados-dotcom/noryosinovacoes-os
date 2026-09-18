import { getSupabaseServerClient } from "@/lib/supabase";
import { buscarStatusConexao } from "@/lib/evolution-status";

/**
 * Canal de atendimento da clínica (Fase Canais + Caixa Compartilhada,
 * 2026-09-18). NÚMERO ≠ ATENDENTE: o número (canal) pertence à clínica, a
 * atendente acessa o canal pelo Noryos. `tipo`/`provider` são texto livre de
 * propósito — hoje só existe whatsapp/evolution, mas nada aqui impede
 * instagram/webchat depois (basta um provider novo em `canais-envio.ts`).
 *
 * Segredo nunca passa por aqui: `credencialRef` é só o NOME de uma env var.
 */

export const TIPO_WHATSAPP = "whatsapp";
export const PROVIDER_EVOLUTION = "evolution";

export type StatusCanal = "connected" | "disconnected" | "connecting" | "error" | "unknown";

export type Canal = {
  id: string;
  clinicaId: string;
  nome: string;
  tipo: string;
  provider: string;
  providerInstanceId: string;
  telefone: string | null;
  status: StatusCanal;
  ativo: boolean;
  principal: boolean;
  credencialRef: string | null;
  lastWebhookAt: string | null;
  lastMessageInAt: string | null;
  lastMessageOutAt: string | null;
  lastError: string | null;
};

/** O que a UI (e qualquer JSON pro navegador) pode ver — sem `credencialRef`. */
export type CanalPublico = Omit<Canal, "credencialRef">;

const COLUNAS =
  "id, clinica_id, nome, tipo, provider, provider_instance_id, telefone, status, ativo, principal, credencial_ref, last_webhook_at, last_message_in_at, last_message_out_at, last_error";

const STATUS_VALIDOS: readonly StatusCanal[] = ["connected", "disconnected", "connecting", "error", "unknown"];

export function mapearCanal(row: Record<string, unknown>): Canal {
  const status = row.status as string;
  return {
    id: row.id as string,
    clinicaId: row.clinica_id as string,
    nome: row.nome as string,
    tipo: (row.tipo as string) ?? TIPO_WHATSAPP,
    provider: (row.provider as string) ?? PROVIDER_EVOLUTION,
    providerInstanceId: row.provider_instance_id as string,
    telefone: (row.telefone as string | null) ?? null,
    status: (STATUS_VALIDOS as readonly string[]).includes(status) ? (status as StatusCanal) : "unknown",
    ativo: row.ativo as boolean,
    principal: row.principal as boolean,
    credencialRef: (row.credencial_ref as string | null) ?? null,
    lastWebhookAt: (row.last_webhook_at as string | null) ?? null,
    lastMessageInAt: (row.last_message_in_at as string | null) ?? null,
    lastMessageOutAt: (row.last_message_out_at as string | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
  };
}

export function paraPublico(canal: Canal): CanalPublico {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { credencialRef, ...publico } = canal;
  return publico;
}

// ---------------------------------------------------------------------------
// Credencial por canal — só o NOME da env var, restrito a EVOLUTION_* pra que
// um `credencial_ref` mal-intencionado nunca leia SUPABASE_SERVICE_ROLE_KEY & cia.
// ---------------------------------------------------------------------------

const REGEX_CREDENCIAL_REF = /^EVOLUTION_[A-Z0-9_]{1,60}$/;

export function credencialRefValida(ref: string | null | undefined): ref is string {
  return typeof ref === "string" && REGEX_CREDENCIAL_REF.test(ref);
}

/** Token do canal (se `credencial_ref` aponta pra uma env var válida e definida); senão null → chave global da integração. */
export function apiKeyDoCanal(canal: Pick<Canal, "credencialRef">, env: NodeJS.ProcessEnv = process.env): string | null {
  if (!credencialRefValida(canal.credencialRef)) return null;
  return env[canal.credencialRef] || null;
}

/** Tokens que o webhook aceita como prova de origem pra um canal: global + instância legada + o do próprio canal. */
export function tokensAceitosWebhook(canal: Pick<Canal, "credencialRef"> | null, env: NodeJS.ProcessEnv = process.env): string[] {
  const tokens = [env.EVOLUTION_API_KEY, env.EVOLUTION_INSTANCE_TOKEN];
  if (canal) tokens.push(apiKeyDoCanal(canal, env) ?? undefined);
  return tokens.filter((t): t is string => Boolean(t));
}

// ---------------------------------------------------------------------------
// Decisão de envio — pura, testável. Nunca cai pra outro número (sem fallback).
// ---------------------------------------------------------------------------

export type DecisaoEnvioCanal =
  | { pode: true }
  | { pode: false; error: "canal_pausado" | "canal_indisponivel" | "provider_nao_suportado" };

export function decidirEnvioCanal(
  canal: Pick<Canal, "ativo" | "status" | "tipo" | "provider">,
  conectadoAoVivo?: boolean | null
): DecisaoEnvioCanal {
  if (canal.tipo !== TIPO_WHATSAPP || canal.provider !== PROVIDER_EVOLUTION) {
    return { pode: false, error: "provider_nao_suportado" };
  }
  if (!canal.ativo) return { pode: false, error: "canal_pausado" };
  // O status salvo é só dica: se diz "desconectado", quem chamou checou o provider ao vivo.
  if (canal.status === "disconnected" || canal.status === "error") {
    return conectadoAoVivo === true ? { pode: true } : { pode: false, error: "canal_indisponivel" };
  }
  return { pode: true };
}

export function statusPorConexao(conectado: boolean | null): StatusCanal {
  if (conectado === true) return "connected";
  if (conectado === false) return "disconnected";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function listarCanais(clinicaId: string): Promise<Canal[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("canais")
    .select(COLUNAS)
    .eq("clinica_id", clinicaId)
    .order("principal", { ascending: false })
    .order("created_at", { ascending: true });
  if (error || !data) {
    console.error("[canais] listar_failed", JSON.stringify({ code: error?.code ?? null }));
    return [];
  }
  return data.map(mapearCanal);
}

export async function buscarCanalPorId(clinicaId: string, canalId: string): Promise<Canal | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.from("canais").select(COLUNAS).eq("id", canalId).eq("clinica_id", clinicaId).maybeSingle();
  return data ? mapearCanal(data) : null;
}

/** Autoridade do webhook: a instância que a Evolution informa decide canal E clínica — nunca dado vindo do cliente. */
export async function buscarCanalPorInstancia(provider: string, instanciaId: string): Promise<Canal | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("canais")
    .select(COLUNAS)
    .eq("provider", provider)
    .eq("provider_instance_id", instanciaId)
    .maybeSingle();
  return data ? mapearCanal(data) : null;
}

/**
 * Canal padrão da clínica — usado onde não existe conversa (disparo, alerta
 * interno, reativação sem canal). Clínica sem nenhum canal (deploy novo,
 * pré-migração) ganha o principal criado a partir do env `EVOLUTION_INSTANCE`,
 * uma única vez — é o que faz um deploy revendido "funcionar sozinho".
 */
export async function buscarCanalPrincipal(clinicaId: string): Promise<Canal | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.from("canais").select(COLUNAS).eq("clinica_id", clinicaId).eq("principal", true).maybeSingle();
  if (data) return mapearCanal(data);

  return garantirCanalPrincipal(clinicaId);
}

async function garantirCanalPrincipal(clinicaId: string): Promise<Canal | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { count } = await supabase.from("canais").select("id", { count: "exact", head: true }).eq("clinica_id", clinicaId);
  if ((count ?? 0) > 0) return null; // tem canais, só nenhum é principal: escolha explícita do dono, nunca automática.

  const instancia = process.env.EVOLUTION_INSTANCE;
  if (!instancia) return null;

  const { data, error } = await supabase
    .from("canais")
    .insert({ clinica_id: clinicaId, nome: "WhatsApp Principal", provider_instance_id: instancia, principal: true })
    .select(COLUNAS)
    .single();
  if (error || !data) {
    // 23505: outro processo criou no mesmo instante — relê.
    const { data: existente } = await supabase.from("canais").select(COLUNAS).eq("clinica_id", clinicaId).eq("principal", true).maybeSingle();
    return existente ? mapearCanal(existente) : null;
  }
  return mapearCanal(data);
}

export async function buscarCanalDaConversa(clinicaId: string, conversaId: string): Promise<Canal | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("conversas")
    .select("canal_id")
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  // Conversa inexistente (ou de outra clínica): nunca cai no principal — senão envio "pra ninguém" sairia por um número.
  if (!data) return null;
  const canalId = (data.canal_id as string | null) ?? null;
  // Conversa legada SEM canal (não deveria existir pós-backfill): principal, nunca "qualquer um".
  return canalId ? buscarCanalPorId(clinicaId, canalId) : buscarCanalPrincipal(clinicaId);
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export type ResultadoCanal = { ok: true; canal: Canal } | { ok: false; error: string };

export async function criarCanal(
  clinicaId: string,
  entrada: { nome: string; providerInstanceId: string; credencialRef?: string | null }
): Promise<ResultadoCanal> {
  const nome = entrada.nome.trim();
  const instancia = entrada.providerInstanceId.trim();
  if (!nome) return { ok: false, error: "nome_vazio" };
  if (nome.length > 60) return { ok: false, error: "nome_muito_longo" };
  if (!/^[A-Za-z0-9_.-]{2,80}$/.test(instancia)) return { ok: false, error: "instancia_invalida" };
  if (entrada.credencialRef && !credencialRefValida(entrada.credencialRef)) return { ok: false, error: "credencial_ref_invalida" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { count } = await supabase.from("canais").select("id", { count: "exact", head: true }).eq("clinica_id", clinicaId);

  const { data, error } = await supabase
    .from("canais")
    .insert({
      clinica_id: clinicaId,
      nome,
      provider_instance_id: instancia,
      credencial_ref: entrada.credencialRef ?? null,
      principal: (count ?? 0) === 0,
    })
    .select(COLUNAS)
    .single();
  if (error || !data) {
    return { ok: false, error: error?.code === "23505" ? "instancia_ja_cadastrada" : "insert_failed" };
  }
  return { ok: true, canal: mapearCanal(data) };
}

export async function atualizarCanal(
  clinicaId: string,
  canalId: string,
  patch: { nome?: string; ativo?: boolean }
): Promise<ResultadoCanal> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.nome !== undefined) {
    const nome = patch.nome.trim();
    if (!nome) return { ok: false, error: "nome_vazio" };
    if (nome.length > 60) return { ok: false, error: "nome_muito_longo" };
    payload.nome = nome;
  }
  if (patch.ativo !== undefined) {
    if (!patch.ativo) {
      const atual = await buscarCanalPorId(clinicaId, canalId);
      // Pausar o principal deixaria disparos/alertas sem destino: troca o principal antes.
      if (atual?.principal) return { ok: false, error: "canal_principal_nao_pode_pausar" };
    }
    payload.ativo = patch.ativo;
  }

  const { data, error } = await supabase
    .from("canais")
    .update(payload)
    .eq("id", canalId)
    .eq("clinica_id", clinicaId)
    .select(COLUNAS)
    .maybeSingle();
  if (error) return { ok: false, error: "update_failed" };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true, canal: mapearCanal(data) };
}

export async function definirCanalPrincipal(clinicaId: string, canalId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };
  const { data, error } = await supabase.rpc("definir_canal_principal", { p_clinica: clinicaId, p_canal: canalId });
  if (error) return { ok: false, error: "update_failed" };
  const resultado = data as { ok: boolean; error?: string };
  return resultado.ok ? { ok: true } : { ok: false, error: resultado.error ?? "update_failed" };
}

// ---------------------------------------------------------------------------
// Saúde (reaproveitável pelo futuro Noryos Ops)
// ---------------------------------------------------------------------------

/**
 * Atividade recente do canal. `webhook` é acionado a cada mensagem recebida,
 * então é throttled (60 s) contra o `lastWebhookAt` que o chamador já tem em
 * mãos — nenhuma leitura extra por webhook.
 */
export async function registrarAtividadeCanal(
  canal: Pick<Canal, "id" | "lastWebhookAt">,
  evento: { tipo: "webhook_in" | "webhook_out" | "envio_ok" } | { tipo: "erro"; mensagem: string }
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const agora = new Date();
  const iso = agora.toISOString();
  const patch: Record<string, unknown> = {};

  if (evento.tipo === "erro") {
    patch.last_error = evento.mensagem.slice(0, 200);
  } else if (evento.tipo === "envio_ok") {
    patch.last_message_out_at = iso;
    patch.last_error = null;
  } else {
    if (canal.lastWebhookAt && agora.getTime() - new Date(canal.lastWebhookAt).getTime() < 60_000) return;
    patch.last_webhook_at = iso;
    if (evento.tipo === "webhook_in") patch.last_message_in_at = iso;
    else patch.last_message_out_at = iso;
  }

  const { error } = await supabase.from("canais").update(patch).eq("id", canal.id);
  if (error) console.error("[canais] atividade_failed", JSON.stringify({ code: error.code ?? null }));
}

export type SaudeCanal = {
  canalId: string;
  status: StatusCanal;
  conectadoAoVivo: boolean | null;
  telefone: string | null;
  lastWebhookAt: string | null;
  lastMessageInAt: string | null;
  lastMessageOutAt: string | null;
  lastError: string | null;
};

/** Consulta o provider AGORA e grava status/telefone no canal (o valor salvo nunca é a única fonte). */
export async function verificarSaudeCanal(canal: Canal): Promise<SaudeCanal> {
  const vivo = canal.provider === PROVIDER_EVOLUTION ? await buscarStatusConexao(canal.providerInstanceId) : null;
  const conectado = vivo?.erro ? null : (vivo?.conectado ?? null);
  const status: StatusCanal = vivo?.erro ? (vivo.erro === "nao_configurado" ? "unknown" : "error") : statusPorConexao(conectado);
  const telefone = vivo?.numero ?? canal.telefone;

  const supabase = getSupabaseServerClient();
  if (supabase && (status !== canal.status || telefone !== canal.telefone)) {
    await supabase.from("canais").update({ status, telefone, updated_at: new Date().toISOString() }).eq("id", canal.id);
  }

  return {
    canalId: canal.id,
    status,
    conectadoAoVivo: conectado,
    telefone,
    lastWebhookAt: canal.lastWebhookAt,
    lastMessageInAt: canal.lastMessageInAt,
    lastMessageOutAt: canal.lastMessageOutAt,
    lastError: canal.lastError,
  };
}
