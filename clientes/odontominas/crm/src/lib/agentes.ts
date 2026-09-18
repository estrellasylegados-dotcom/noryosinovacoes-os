import { getSupabaseServerClient } from "@/lib/supabase";
import { enviarPeloCanal } from "@/lib/canais-envio";
import { buscarCanalDaConversa } from "@/lib/canais";
import { decidirTransicaoWebhook } from "@/lib/funil";
import { isStatusValido, STATUS_RESOLVIDOS, type StatusConversa } from "@/lib/status";
import { buscarModelo, gerarResposta, type MensagemHistorico, type ProvedorId } from "@/lib/ia-provedores";
import { detectarIntencaoCompra, detectarPedidoHumano, notificarEquipe } from "@/lib/agentes-notificacoes";
import { contarConhecimento, criarConhecimento, listarConhecimento } from "@/lib/agentes-conhecimento";
import { aplicarQualificacaoAutomatica, classificarQualificacao } from "@/lib/agentes-qualificacao";
import { dispararPixelSeConfigurado } from "@/lib/agentes-pixel";
import { buscarCampanha, labelObjetivo } from "@/lib/campanhas";
import { assumirControle, liberarControle } from "@/lib/dono-conversa";

/**
 * Agentes de IA — a pedido do Rafael (prints da RoiZap como referência de
 * layout, ver andamento.md/plano em `_memoria`), adaptado ao que o CRM
 * realmente tem: um agente por clínica, ativado quando a `etiqueta_gatilho`
 * dele é aplicada numa conversa (reaproveita etiquetas.ts, não cria
 * catálogo de tag novo).
 *
 * `decidirAtivarAgentePorEtiqueta`/`deveResponder` são puras e testáveis
 * isoladas (mesmo padrão de funil.ts). `responderComoAgente` é a
 * orquestração — mesmo formato de reativacao.ts (ler Supabase → gerar →
 * enviar → gravar), chamada pelo webhook quando `deveResponder` diz sim.
 *
 * Fase 2A (a pedido do Rafael, depois de comparar com o print completo da
 * RoiZap de novo): horário de atendimento, tamanho máximo da resposta,
 * dividir em mensagens curtas, pausar após concluir o fluxo, transferência
 * pra humano real (detecção por palavra-chave — src/lib/agentes-notificacoes.ts
 * — não por IA, fica determinístico e testável) e "Avisar Membro da Equipe"
 * (a rede de segurança: notifica um número interno em 4 situações).
 *
 * Fase 2B (Buffer de mensagens, opt-in por agente): ver src/lib/agentes-buffer.ts.
 * `responderComoAgente` não sabe nada sobre buffer — recebe o texto (de uma
 * mensagem só, ou já combinado de uma rajada) e responde do mesmo jeito.
 *
 * Prompt estruturado + Conhecimento (a pedido do Rafael, print do "Agente 01"
 * da RoiZap): `modoPrompt` escolhe entre o textarea único de sempre
 * ('avancado', `promptSistema`) e os campos estruturados ('simples' — persona/
 * objetivo/fluxoTriagem/guardrails/tomVoz/usarEmojis). `montarPromptSistema`
 * é quem decide o texto final mandado pro provedor de IA; `responderComoAgente`
 * chama ela em vez de usar `agente.promptSistema` cru. Conhecimento
 * (src/lib/agentes-conhecimento.ts) entra nos dois modos, sempre no fim do
 * prompt.
 *
 * Qualificação Automática de Leads (opt-in por agente, `qualificacaoAutomatica`):
 * depois de responder, `responderComoAgente` chama
 * src/lib/agentes-qualificacao.ts pra classificar a conversa em
 * Quente/Morno/Frio e aplicar a etiqueta correspondente — nunca derruba a
 * resposta já enviada se a classificação falhar (try/catch isolado ali).
 *
 * Pixel de Conversão (opt-in por agente, `pixelAtivo`): 3 eventos do funil
 * (novo lead, lead quente, agendado) disparados pra Facebook Conversions API
 * e Google Ads via src/lib/agentes-pixel.ts — `responderComoAgente` dispara
 * novo_lead e lead_quente; `atualizarStatus` (src/lib/conversas.ts)
 * dispara agendado. Nunca mais de uma vez por conversa (dedup no próprio
 * agentes-pixel.ts).
 */

export type ModoPrompt = "simples" | "avancado";
export type TomVoz = "amigavel" | "formal" | "entusiasmado" | "direto";

export type ItemConhecimento = { titulo: string; conteudo: string };

export type AgenteIA = {
  id: string;
  clinicaId: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  etiquetaGatilhoId: string | null;
  provider: ProvedorId;
  modelo: string;
  promptSistema: string;
  modoPrompt: ModoPrompt;
  persona: string;
  objetivo: string;
  fluxoTriagem: string;
  guardrails: string;
  tomVoz: TomVoz;
  usarEmojis: boolean;
  temperatura: number;
  maxTokens: number;
  maxMensagensResposta: number;
  incluirHistorico: boolean;
  qtdHistorico: number;
  pausarAoResponderHumano: boolean;
  tempoPausaMin: number;
  mensagemTransferencia: string | null;
  responderApenasHorario: boolean;
  horarioInicio: string | null;
  horarioFim: string | null;
  maxCaracteresResposta: number | null;
  pausarAposConcluirFluxo: boolean;
  dividirEmMensagensCurtas: boolean;
  ativarTransferencia: boolean;
  notificarNumeros: string | null;
  notificarPedidoHumano: boolean;
  notificarFallback: boolean;
  notificarIntencaoCompra: boolean;
  notificarNovoLead: boolean;
  mensagemNotificacao: string | null;
  bufferMensagens: boolean;
  bufferSegundos: number;
  qualificacaoAutomatica: boolean;
  pixelAtivo: boolean;
  pixelFacebookPixelId: string | null;
  pixelFacebookAccessToken: string | null;
  pixelGoogleCustomerId: string | null;
  pixelGoogleLoginCustomerId: string | null;
  pixelGoogleRefreshToken: string | null;
  pixelGoogleConversionActionNovoLead: string | null;
  pixelGoogleConversionActionQuente: string | null;
  pixelGoogleConversionActionAgendado: string | null;
};

export type DadosAgente = {
  nome: string;
  descricao?: string | null;
  etiquetaGatilhoId?: string | null;
  provider: ProvedorId;
  modelo: string;
  promptSistema?: string;
  modoPrompt?: ModoPrompt;
  persona?: string;
  objetivo?: string;
  fluxoTriagem?: string;
  guardrails?: string;
  tomVoz?: TomVoz;
  usarEmojis?: boolean;
  temperatura?: number;
  maxTokens?: number;
  maxMensagensResposta?: number;
  incluirHistorico?: boolean;
  qtdHistorico?: number;
  pausarAoResponderHumano?: boolean;
  tempoPausaMin?: number;
  mensagemTransferencia?: string | null;
  responderApenasHorario?: boolean;
  horarioInicio?: string | null;
  horarioFim?: string | null;
  maxCaracteresResposta?: number | null;
  pausarAposConcluirFluxo?: boolean;
  dividirEmMensagensCurtas?: boolean;
  ativarTransferencia?: boolean;
  notificarNumeros?: string | null;
  notificarPedidoHumano?: boolean;
  notificarFallback?: boolean;
  notificarIntencaoCompra?: boolean;
  notificarNovoLead?: boolean;
  mensagemNotificacao?: string | null;
  bufferMensagens?: boolean;
  bufferSegundos?: number;
  qualificacaoAutomatica?: boolean;
  pixelAtivo?: boolean;
  pixelFacebookPixelId?: string | null;
  pixelFacebookAccessToken?: string | null;
  pixelGoogleCustomerId?: string | null;
  pixelGoogleLoginCustomerId?: string | null;
  pixelGoogleRefreshToken?: string | null;
  pixelGoogleConversionActionNovoLead?: string | null;
  pixelGoogleConversionActionQuente?: string | null;
  pixelGoogleConversionActionAgendado?: string | null;
};

const SELECT_AGENTE =
  "id, clinica_id, nome, descricao, ativo, etiqueta_gatilho_id, provider, modelo, prompt_sistema, modo_prompt, persona, objetivo, fluxo_triagem, guardrails, tom_voz, usar_emojis, temperatura, max_tokens, max_mensagens_resposta, incluir_historico, qtd_historico, pausar_ao_responder_humano, tempo_pausa_min, mensagem_transferencia, " +
  "responder_apenas_horario, horario_inicio, horario_fim, max_caracteres_resposta, pausar_apos_concluir_fluxo, dividir_em_mensagens_curtas, ativar_transferencia, notificar_numeros, notificar_pedido_humano, notificar_fallback, notificar_intencao_compra, notificar_novo_lead, mensagem_notificacao, buffer_mensagens, buffer_segundos, qualificacao_automatica, " +
  "pixel_ativo, pixel_facebook_pixel_id, pixel_facebook_access_token, pixel_google_customer_id, pixel_google_login_customer_id, pixel_google_refresh_token, pixel_google_conversion_action_novo_lead, pixel_google_conversion_action_quente, pixel_google_conversion_action_agendado";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAgente(row: any): AgenteIA {
  return {
    id: row.id,
    clinicaId: row.clinica_id,
    nome: row.nome,
    descricao: row.descricao ?? null,
    ativo: row.ativo,
    etiquetaGatilhoId: row.etiqueta_gatilho_id ?? null,
    provider: row.provider,
    modelo: row.modelo,
    promptSistema: row.prompt_sistema ?? "",
    modoPrompt: (row.modo_prompt as ModoPrompt) ?? "avancado",
    persona: row.persona ?? "",
    objetivo: row.objetivo ?? "",
    fluxoTriagem: row.fluxo_triagem ?? "",
    guardrails: row.guardrails ?? "",
    tomVoz: (row.tom_voz as TomVoz) ?? "amigavel",
    usarEmojis: row.usar_emojis ?? true,
    temperatura: Number(row.temperatura),
    maxTokens: row.max_tokens,
    maxMensagensResposta: row.max_mensagens_resposta,
    incluirHistorico: row.incluir_historico,
    qtdHistorico: row.qtd_historico,
    pausarAoResponderHumano: row.pausar_ao_responder_humano,
    tempoPausaMin: row.tempo_pausa_min,
    mensagemTransferencia: row.mensagem_transferencia ?? null,
    responderApenasHorario: row.responder_apenas_horario ?? false,
    horarioInicio: row.horario_inicio ?? null,
    horarioFim: row.horario_fim ?? null,
    maxCaracteresResposta: row.max_caracteres_resposta ?? null,
    pausarAposConcluirFluxo: row.pausar_apos_concluir_fluxo ?? false,
    dividirEmMensagensCurtas: row.dividir_em_mensagens_curtas ?? false,
    ativarTransferencia: row.ativar_transferencia ?? false,
    notificarNumeros: row.notificar_numeros ?? null,
    notificarPedidoHumano: row.notificar_pedido_humano ?? true,
    notificarFallback: row.notificar_fallback ?? false,
    notificarIntencaoCompra: row.notificar_intencao_compra ?? false,
    notificarNovoLead: row.notificar_novo_lead ?? false,
    mensagemNotificacao: row.mensagem_notificacao ?? null,
    bufferMensagens: row.buffer_mensagens ?? false,
    bufferSegundos: row.buffer_segundos ?? 8,
    qualificacaoAutomatica: row.qualificacao_automatica ?? false,
    pixelAtivo: row.pixel_ativo ?? false,
    pixelFacebookPixelId: row.pixel_facebook_pixel_id ?? null,
    pixelFacebookAccessToken: row.pixel_facebook_access_token ?? null,
    pixelGoogleCustomerId: row.pixel_google_customer_id ?? null,
    pixelGoogleLoginCustomerId: row.pixel_google_login_customer_id ?? null,
    pixelGoogleRefreshToken: row.pixel_google_refresh_token ?? null,
    pixelGoogleConversionActionNovoLead: row.pixel_google_conversion_action_novo_lead ?? null,
    pixelGoogleConversionActionQuente: row.pixel_google_conversion_action_quente ?? null,
    pixelGoogleConversionActionAgendado: row.pixel_google_conversion_action_agendado ?? null,
  };
}

const MODOS_PROMPT: ModoPrompt[] = ["simples", "avancado"];
const TONS_VOZ: TomVoz[] = ["amigavel", "formal", "entusiasmado", "direto"];

function validarDados(dados: DadosAgente): string | null {
  if (!dados.nome?.trim()) return "nome_obrigatorio";
  if (!buscarModelo(dados.provider, dados.modelo)) return "modelo_invalido";
  if (dados.temperatura !== undefined && (dados.temperatura < 0 || dados.temperatura > 1)) return "temperatura_invalida";
  if (dados.modoPrompt !== undefined && !MODOS_PROMPT.includes(dados.modoPrompt)) return "modo_prompt_invalido";
  if (dados.tomVoz !== undefined && !TONS_VOZ.includes(dados.tomVoz)) return "tom_voz_invalido";
  return null;
}

function payloadDados(dados: DadosAgente) {
  return {
    nome: dados.nome.trim(),
    descricao: dados.descricao?.trim() || null,
    etiqueta_gatilho_id: dados.etiquetaGatilhoId ?? null,
    provider: dados.provider,
    modelo: dados.modelo,
    prompt_sistema: dados.promptSistema ?? "",
    modo_prompt: dados.modoPrompt ?? "simples",
    persona: dados.persona?.trim() ?? "",
    objetivo: dados.objetivo?.trim() ?? "",
    fluxo_triagem: dados.fluxoTriagem?.trim() ?? "",
    guardrails: dados.guardrails?.trim() ?? "",
    tom_voz: dados.tomVoz ?? "amigavel",
    usar_emojis: dados.usarEmojis ?? true,
    temperatura: dados.temperatura ?? 0.7,
    max_tokens: dados.maxTokens ?? 700,
    max_mensagens_resposta: dados.maxMensagensResposta ?? 3,
    incluir_historico: dados.incluirHistorico ?? true,
    qtd_historico: dados.qtdHistorico ?? 10,
    pausar_ao_responder_humano: dados.pausarAoResponderHumano ?? true,
    tempo_pausa_min: dados.tempoPausaMin ?? 480,
    mensagem_transferencia: dados.mensagemTransferencia?.trim() || null,
    responder_apenas_horario: dados.responderApenasHorario ?? false,
    horario_inicio: dados.horarioInicio || null,
    horario_fim: dados.horarioFim || null,
    max_caracteres_resposta: dados.maxCaracteresResposta ?? null,
    pausar_apos_concluir_fluxo: dados.pausarAposConcluirFluxo ?? false,
    dividir_em_mensagens_curtas: dados.dividirEmMensagensCurtas ?? false,
    ativar_transferencia: dados.ativarTransferencia ?? false,
    notificar_numeros: dados.notificarNumeros?.trim() || null,
    notificar_pedido_humano: dados.notificarPedidoHumano ?? true,
    notificar_fallback: dados.notificarFallback ?? false,
    notificar_intencao_compra: dados.notificarIntencaoCompra ?? false,
    notificar_novo_lead: dados.notificarNovoLead ?? false,
    mensagem_notificacao: dados.mensagemNotificacao?.trim() || null,
    buffer_mensagens: dados.bufferMensagens ?? false,
    buffer_segundos: dados.bufferSegundos ?? 8,
    qualificacao_automatica: dados.qualificacaoAutomatica ?? false,
    pixel_ativo: dados.pixelAtivo ?? false,
    pixel_facebook_pixel_id: dados.pixelFacebookPixelId?.trim() || null,
    pixel_facebook_access_token: dados.pixelFacebookAccessToken?.trim() || null,
    pixel_google_customer_id: dados.pixelGoogleCustomerId?.trim() || null,
    pixel_google_login_customer_id: dados.pixelGoogleLoginCustomerId?.trim() || null,
    pixel_google_refresh_token: dados.pixelGoogleRefreshToken?.trim() || null,
    pixel_google_conversion_action_novo_lead: dados.pixelGoogleConversionActionNovoLead?.trim() || null,
    pixel_google_conversion_action_quente: dados.pixelGoogleConversionActionQuente?.trim() || null,
    pixel_google_conversion_action_agendado: dados.pixelGoogleConversionActionAgendado?.trim() || null,
  };
}

export async function listarAgentes(clinicaId: string): Promise<AgenteIA[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("agentes_ia")
    .select(SELECT_AGENTE)
    .eq("clinica_id", clinicaId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    if (error) console.error("[agentes] listar_failed", JSON.stringify({ code: error.code ?? null }));
    return [];
  }

  return data.map(mapAgente);
}

export async function buscarAgente(clinicaId: string, id: string): Promise<AgenteIA | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from("agentes_ia").select(SELECT_AGENTE).eq("id", id).eq("clinica_id", clinicaId).maybeSingle();
  if (error || !data) return null;

  return mapAgente(data);
}

export async function criarAgente(clinicaId: string, dados: DadosAgente): Promise<{ ok: boolean; agente?: AgenteIA; error?: string }> {
  const erroValidacao = validarDados(dados);
  if (erroValidacao) return { ok: false, error: erroValidacao };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data, error } = await supabase
    .from("agentes_ia")
    .insert({ clinica_id: clinicaId, ativo: false, ...payloadDados(dados) })
    .select(SELECT_AGENTE)
    .single();

  if (error || !data) {
    console.error("[agentes] criar_failed", JSON.stringify({ code: error?.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  return { ok: true, agente: mapAgente(data) };
}

export async function atualizarAgente(
  clinicaId: string,
  id: string,
  dados: Partial<DadosAgente> & { ativo?: boolean }
): Promise<{ ok: boolean; agente?: AgenteIA; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const atual = await buscarAgente(clinicaId, id);
  if (!atual) return { ok: false, error: "not_found" };

  const mesclado: DadosAgente = {
    nome: dados.nome ?? atual.nome,
    descricao: dados.descricao !== undefined ? dados.descricao : atual.descricao,
    etiquetaGatilhoId: dados.etiquetaGatilhoId !== undefined ? dados.etiquetaGatilhoId : atual.etiquetaGatilhoId,
    provider: dados.provider ?? atual.provider,
    modelo: dados.modelo ?? atual.modelo,
    promptSistema: dados.promptSistema !== undefined ? dados.promptSistema : atual.promptSistema,
    modoPrompt: dados.modoPrompt ?? atual.modoPrompt,
    persona: dados.persona !== undefined ? dados.persona : atual.persona,
    objetivo: dados.objetivo !== undefined ? dados.objetivo : atual.objetivo,
    fluxoTriagem: dados.fluxoTriagem !== undefined ? dados.fluxoTriagem : atual.fluxoTriagem,
    guardrails: dados.guardrails !== undefined ? dados.guardrails : atual.guardrails,
    tomVoz: dados.tomVoz ?? atual.tomVoz,
    usarEmojis: dados.usarEmojis ?? atual.usarEmojis,
    temperatura: dados.temperatura ?? atual.temperatura,
    maxTokens: dados.maxTokens ?? atual.maxTokens,
    maxMensagensResposta: dados.maxMensagensResposta ?? atual.maxMensagensResposta,
    incluirHistorico: dados.incluirHistorico ?? atual.incluirHistorico,
    qtdHistorico: dados.qtdHistorico ?? atual.qtdHistorico,
    pausarAoResponderHumano: dados.pausarAoResponderHumano ?? atual.pausarAoResponderHumano,
    tempoPausaMin: dados.tempoPausaMin ?? atual.tempoPausaMin,
    mensagemTransferencia: dados.mensagemTransferencia !== undefined ? dados.mensagemTransferencia : atual.mensagemTransferencia,
    responderApenasHorario: dados.responderApenasHorario ?? atual.responderApenasHorario,
    horarioInicio: dados.horarioInicio !== undefined ? dados.horarioInicio : atual.horarioInicio,
    horarioFim: dados.horarioFim !== undefined ? dados.horarioFim : atual.horarioFim,
    maxCaracteresResposta: dados.maxCaracteresResposta !== undefined ? dados.maxCaracteresResposta : atual.maxCaracteresResposta,
    pausarAposConcluirFluxo: dados.pausarAposConcluirFluxo ?? atual.pausarAposConcluirFluxo,
    dividirEmMensagensCurtas: dados.dividirEmMensagensCurtas ?? atual.dividirEmMensagensCurtas,
    ativarTransferencia: dados.ativarTransferencia ?? atual.ativarTransferencia,
    notificarNumeros: dados.notificarNumeros !== undefined ? dados.notificarNumeros : atual.notificarNumeros,
    notificarPedidoHumano: dados.notificarPedidoHumano ?? atual.notificarPedidoHumano,
    notificarFallback: dados.notificarFallback ?? atual.notificarFallback,
    notificarIntencaoCompra: dados.notificarIntencaoCompra ?? atual.notificarIntencaoCompra,
    notificarNovoLead: dados.notificarNovoLead ?? atual.notificarNovoLead,
    mensagemNotificacao: dados.mensagemNotificacao !== undefined ? dados.mensagemNotificacao : atual.mensagemNotificacao,
    bufferMensagens: dados.bufferMensagens ?? atual.bufferMensagens,
    bufferSegundos: dados.bufferSegundos ?? atual.bufferSegundos,
    qualificacaoAutomatica: dados.qualificacaoAutomatica ?? atual.qualificacaoAutomatica,
    pixelAtivo: dados.pixelAtivo ?? atual.pixelAtivo,
    pixelFacebookPixelId: dados.pixelFacebookPixelId !== undefined ? dados.pixelFacebookPixelId : atual.pixelFacebookPixelId,
    pixelFacebookAccessToken:
      dados.pixelFacebookAccessToken !== undefined ? dados.pixelFacebookAccessToken : atual.pixelFacebookAccessToken,
    pixelGoogleCustomerId: dados.pixelGoogleCustomerId !== undefined ? dados.pixelGoogleCustomerId : atual.pixelGoogleCustomerId,
    pixelGoogleLoginCustomerId:
      dados.pixelGoogleLoginCustomerId !== undefined ? dados.pixelGoogleLoginCustomerId : atual.pixelGoogleLoginCustomerId,
    pixelGoogleRefreshToken:
      dados.pixelGoogleRefreshToken !== undefined ? dados.pixelGoogleRefreshToken : atual.pixelGoogleRefreshToken,
    pixelGoogleConversionActionNovoLead:
      dados.pixelGoogleConversionActionNovoLead !== undefined
        ? dados.pixelGoogleConversionActionNovoLead
        : atual.pixelGoogleConversionActionNovoLead,
    pixelGoogleConversionActionQuente:
      dados.pixelGoogleConversionActionQuente !== undefined
        ? dados.pixelGoogleConversionActionQuente
        : atual.pixelGoogleConversionActionQuente,
    pixelGoogleConversionActionAgendado:
      dados.pixelGoogleConversionActionAgendado !== undefined
        ? dados.pixelGoogleConversionActionAgendado
        : atual.pixelGoogleConversionActionAgendado,
  };

  const erroValidacao = validarDados(mesclado);
  if (erroValidacao) return { ok: false, error: erroValidacao };

  const { data, error } = await supabase
    .from("agentes_ia")
    .update({
      ...payloadDados(mesclado),
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinica_id", clinicaId)
    .select(SELECT_AGENTE)
    .single();

  if (error || !data) {
    console.error("[agentes] atualizar_failed", JSON.stringify({ id, code: error?.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  return { ok: true, agente: mapAgente(data) };
}

/** Quantas mensagens cada agente já enviou nesta clínica — usado nos cards da lista (`/agentes`). */
export async function contarMensagensPorAgente(clinicaId: string): Promise<Record<string, number>> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return {};

  const { data, error } = await supabase
    .from("mensagens")
    .select("gerada_por_agente_id")
    .eq("clinica_id", clinicaId)
    .not("gerada_por_agente_id", "is", null);

  if (error || !data) return {};

  const contagem: Record<string, number> = {};
  for (const row of data) {
    const agenteId = row.gerada_por_agente_id as string;
    contagem[agenteId] = (contagem[agenteId] ?? 0) + 1;
  }
  return contagem;
}

export async function excluirAgente(clinicaId: string, id: string): Promise<{ ok: boolean }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false };

  await supabase.from("agentes_ia").delete().eq("id", id).eq("clinica_id", clinicaId);
  return { ok: true };
}

export async function duplicarAgente(clinicaId: string, id: string): Promise<{ ok: boolean; agente?: AgenteIA; error?: string }> {
  const original = await buscarAgente(clinicaId, id);
  if (!original) return { ok: false, error: "not_found" };

  const resultado = await criarAgente(clinicaId, {
    nome: `${original.nome} (cópia)`,
    descricao: original.descricao,
    etiquetaGatilhoId: original.etiquetaGatilhoId,
    provider: original.provider,
    modelo: original.modelo,
    promptSistema: original.promptSistema,
    modoPrompt: original.modoPrompt,
    persona: original.persona,
    objetivo: original.objetivo,
    fluxoTriagem: original.fluxoTriagem,
    guardrails: original.guardrails,
    tomVoz: original.tomVoz,
    usarEmojis: original.usarEmojis,
    temperatura: original.temperatura,
    maxTokens: original.maxTokens,
    maxMensagensResposta: original.maxMensagensResposta,
    incluirHistorico: original.incluirHistorico,
    qtdHistorico: original.qtdHistorico,
    pausarAoResponderHumano: original.pausarAoResponderHumano,
    tempoPausaMin: original.tempoPausaMin,
    mensagemTransferencia: original.mensagemTransferencia,
    responderApenasHorario: original.responderApenasHorario,
    horarioInicio: original.horarioInicio,
    horarioFim: original.horarioFim,
    maxCaracteresResposta: original.maxCaracteresResposta,
    pausarAposConcluirFluxo: original.pausarAposConcluirFluxo,
    dividirEmMensagensCurtas: original.dividirEmMensagensCurtas,
    ativarTransferencia: original.ativarTransferencia,
    notificarNumeros: original.notificarNumeros,
    notificarPedidoHumano: original.notificarPedidoHumano,
    notificarFallback: original.notificarFallback,
    notificarIntencaoCompra: original.notificarIntencaoCompra,
    notificarNovoLead: original.notificarNovoLead,
    mensagemNotificacao: original.mensagemNotificacao,
    bufferMensagens: original.bufferMensagens,
    bufferSegundos: original.bufferSegundos,
    qualificacaoAutomatica: original.qualificacaoAutomatica,
    pixelAtivo: original.pixelAtivo,
    pixelFacebookPixelId: original.pixelFacebookPixelId,
    pixelFacebookAccessToken: original.pixelFacebookAccessToken,
    pixelGoogleCustomerId: original.pixelGoogleCustomerId,
    pixelGoogleLoginCustomerId: original.pixelGoogleLoginCustomerId,
    pixelGoogleRefreshToken: original.pixelGoogleRefreshToken,
    pixelGoogleConversionActionNovoLead: original.pixelGoogleConversionActionNovoLead,
    pixelGoogleConversionActionQuente: original.pixelGoogleConversionActionQuente,
    pixelGoogleConversionActionAgendado: original.pixelGoogleConversionActionAgendado,
  });

  if (resultado.ok && resultado.agente) {
    const itens = await listarConhecimento(clinicaId, original.id);
    for (const item of itens) {
      await criarConhecimento(clinicaId, resultado.agente.id, item.titulo, item.conteudo);
    }
  }

  return resultado;
}

/** Etiqueta acabou de ser aplicada numa conversa: qual agente ativo (se algum) deve passar a escutar essa conversa. */
export function decidirAtivarAgentePorEtiqueta(agentes: AgenteIA[], etiquetaId: string): AgenteIA | null {
  return agentes.find((a) => a.ativo && a.etiquetaGatilhoId === etiquetaId) ?? null;
}

/**
 * "Retomar IA" no Chat ao Vivo: a conversa foi pausada manualmente (sem
 * etiqueta nova), então reaproveita as etiquetas que ela já tem pra achar de
 * novo o agente ativo cuja etiqueta-gatilho bate — mesma regra de
 * decidirAtivarAgentePorEtiqueta, só que testando várias etiquetas de uma vez.
 */
export function decidirAgenteElegivel(agentes: AgenteIA[], etiquetaIds: string[]): AgenteIA | null {
  for (const etiquetaId of etiquetaIds) {
    const agente = decidirAtivarAgentePorEtiqueta(agentes, etiquetaId);
    if (agente) return agente;
  }
  return null;
}

/**
 * Mensagem recebida numa conversa: o agente ativo dela (se algum) deve
 * responder agora? Não responde a mensagem da própria clínica (fromMe), e
 * respeita a pausa temporária depois de um humano responder manualmente
 * (src/lib/chat.ts, enviarRespostaChat).
 */
export function deveResponder(
  conversa: { agenteAtivoId: string | null; agentePausadoAte: string | null },
  agora: Date,
  fromMe: boolean
): boolean {
  if (fromMe) return false;
  if (!conversa.agenteAtivoId) return false;
  if (conversa.agentePausadoAte && new Date(conversa.agentePausadoAte).getTime() > agora.getTime()) return false;
  return true;
}

/** Hora atual em "HH:MM", fuso fixo de Brasília — mesmo padrão de `formatHoraCurta` em tempo.ts. */
export function horaAtualBrasilia(agora: Date): string {
  return agora.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Sem horário configurado, o agente responde a qualquer hora (comportamento de hoje). */
export function dentroDoHorario(horaAtual: string, inicio: string | null, fim: string | null): boolean {
  if (!inicio || !fim) return true;
  return horaAtual >= inicio && horaAtual < fim;
}

/**
 * Divide o texto em até `maxBlocos` mensagens curtas (parágrafo, ou frase se
 * não tiver parágrafo) — "Comportamento conversacional"/"máximo de
 * mensagens por resposta" do print de referência. Blocos que sobrarem além
 * do teto voltam a ser juntados no último bloco, nunca cortados.
 */
export function dividirMensagem(texto: string, maxBlocos: number): string[] {
  const limite = Math.max(1, maxBlocos);
  const porParagrafo = texto
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const blocos = porParagrafo.length > 1 ? porParagrafo : texto.split(/(?<=[.!?])\s+/).map((b) => b.trim()).filter(Boolean);

  if (blocos.length <= limite) return blocos.length > 0 ? blocos : [texto.trim()];

  const inicio = blocos.slice(0, limite - 1);
  const resto = blocos.slice(limite - 1).join(" ");
  return [...inicio, resto];
}

const TOM_VOZ_LABEL: Record<TomVoz, string> = {
  amigavel: "amigável e acolhedor",
  formal: "formal e profissional",
  entusiasmado: "entusiasmado e caloroso",
  direto: "direto e objetivo, sem rodeios",
};

/**
 * Monta o prompt final mandado pro provedor de IA. Modo 'avancado' mantém o
 * comportamento de sempre (textarea único, `promptSistema` cru). Modo
 * 'simples' compõe os campos estruturados do print de referência — guardrails
 * primeiro, "prioridade máxima sobre qualquer outra instrução" (mesmo aviso
 * do print: "Guardrails são injetados com prioridade máxima no topo do
 * prompt"). Conhecimento entra nos dois modos, sempre por último, pra reduzir
 * a IA inventando informação que a clínica não confirmou.
 */
export function montarPromptSistema(
  agente: Pick<
    AgenteIA,
    "modoPrompt" | "promptSistema" | "persona" | "objetivo" | "fluxoTriagem" | "guardrails" | "tomVoz" | "usarEmojis"
  >,
  conhecimento: ItemConhecimento[]
): string {
  const blocoConhecimento = conhecimento.length
    ? `Fatos que você pode usar pra responder (nunca invente além disso):\n${conhecimento
        .map((c) => `- ${c.titulo}: ${c.conteudo}`)
        .join("\n")}`
    : "";

  if (agente.modoPrompt === "avancado") {
    return [agente.promptSistema, blocoConhecimento].filter(Boolean).join("\n\n");
  }

  const partes = [
    agente.guardrails.trim() &&
      `Regras que você NUNCA deve quebrar, prioridade máxima sobre qualquer outra instrução:\n${agente.guardrails.trim()}`,
    agente.persona.trim(),
    agente.objetivo.trim() && `Seu objetivo nesta conversa: ${agente.objetivo.trim()}`,
    agente.fluxoTriagem.trim(),
    `Tom de voz: ${TOM_VOZ_LABEL[agente.tomVoz] ?? agente.tomVoz}. ${
      agente.usarEmojis ? "Pode usar emojis com moderação." : "Não use emojis."
    }`,
    blocoConhecimento,
  ];
  return partes.filter(Boolean).join("\n\n");
}

export type MensagemParaTempoResposta = {
  conversaId: string;
  direcao: "recebida" | "enviada";
  createdAt: string;
  geradaPorAgenteId: string | null;
};

/**
 * Tempo médio (ms) entre uma mensagem recebida e a próxima resposta desse
 * agente na mesma conversa — o card "Tempo Médio" do print de referência.
 * `mensagens` precisa vir em ordem cronológica (created_at crescente); função
 * pura e testável, mesmo padrão de `resumo.ts`/`funil.ts`. Retorna `null` sem
 * nenhum par recebida→resposta do agente.
 */
export function calcularTempoMedioRespostaMs(mensagens: MensagemParaTempoResposta[], agenteId: string): number | null {
  const porConversa = new Map<string, MensagemParaTempoResposta[]>();
  for (const m of mensagens) {
    const lista = porConversa.get(m.conversaId) ?? [];
    lista.push(m);
    porConversa.set(m.conversaId, lista);
  }

  const deltas: number[] = [];
  for (const lista of porConversa.values()) {
    let recebidaPendenteEm: number | null = null;
    for (const m of lista) {
      if (m.direcao === "recebida") {
        recebidaPendenteEm = new Date(m.createdAt).getTime();
        continue;
      }
      if (m.direcao === "enviada" && m.geradaPorAgenteId === agenteId && recebidaPendenteEm !== null) {
        deltas.push(new Date(m.createdAt).getTime() - recebidaPendenteEm);
        recebidaPendenteEm = null;
      }
    }
  }

  if (deltas.length === 0) return null;
  return deltas.reduce((soma, d) => soma + d, 0) / deltas.length;
}

/**
 * Humano respondeu manualmente (src/lib/chat.ts, enviarRespostaChat): se a
 * conversa tem um agente ativo configurado pra pausar quando isso acontece,
 * grava a trava temporária. Silencioso de propósito (nunca falha o envio
 * manual por causa disso).
 */
export async function pausarAgenteSeConfigurado(clinicaId: string, conversaId: string, agenteAtivoId: string | null): Promise<void> {
  if (!agenteAtivoId) return;

  const agente = await buscarAgente(clinicaId, agenteAtivoId);
  if (!agente || !agente.pausarAoResponderHumano) return;

  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const pausadoAte = new Date(Date.now() + agente.tempoPausaMin * 60_000).toISOString();
  const { error } = await supabase
    .from("conversas")
    .update({ agente_pausado_ate: pausadoAte })
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId);
  if (error) {
    console.error("[agentes] pausar_failed", JSON.stringify({ conversaId, code: error.code ?? null }));
  }
}

/**
 * "Pausar IA" no Chat ao Vivo (a pedido do Rafael): um humano assume a
 * conversa na hora, sem esperar a pausa temporária de
 * pausarAgenteSeConfigurado nem depender de reaplicar etiqueta. Desliga de
 * vez (`agente_ativo_id = null`) até alguém retomar ou reaplicar a etiqueta.
 */
export async function pausarAgenteManual(clinicaId: string, conversaId: string): Promise<{ ok: boolean }> {
  const resultado = await liberarControle(clinicaId, conversaId, { agente_ativo_id: null, agente_pausado_ate: null });
  if (!resultado.ok) {
    console.error("[agentes] pausar_manual_failed", JSON.stringify({ conversaId }));
    return { ok: false };
  }
  return { ok: true };
}

/** "Retomar IA": reconecta o agente elegível pelas etiquetas que a conversa já tem, sem precisar remover e reaplicar a etiqueta. */
export async function retomarAgente(clinicaId: string, conversaId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const [{ data: etiquetasLinks }, agentes] = await Promise.all([
    supabase.from("conversa_etiquetas").select("etiqueta_id").eq("conversa_id", conversaId),
    listarAgentes(clinicaId),
  ]);

  const etiquetaIds = (etiquetasLinks ?? []).map((r) => r.etiqueta_id as string);
  const agente = decidirAgenteElegivel(agentes, etiquetaIds);
  if (!agente) return { ok: false, error: "sem_agente_elegivel" };

  const resultado = await assumirControle(clinicaId, conversaId, "agente_ia", {
    agente_ativo_id: agente.id,
    agente_pausado_ate: null,
    ultimo_agente_id: agente.id,
  });
  if (!resultado.ok) {
    console.error("[agentes] retomar_failed", JSON.stringify({ conversaId }));
    return { ok: false, error: "update_failed" };
  }
  return { ok: true };
}

const MENSAGEM_TRANSFERENCIA_PADRAO = "Já vou te encaminhar pra nossa equipe, um momento 🙏";

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Manda um ou mais blocos de texto em sequência (mesma conversa) e grava
 * cada um como mensagem gerada pelo agente. Só a 1ª falha de envio derruba o
 * resultado — bolha seguinte que falhar só fica logada (o essencial, a
 * resposta, já saiu).
 */
async function enviarBlocos(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  clinicaId: string,
  conversaId: string,
  telefone: string,
  blocos: string[],
  agenteId: string
): Promise<{ ok: boolean; error?: string }> {
  // Canal resolvido UMA vez (o da conversa) — todos os blocos saem pelo mesmo número.
  const canal = await buscarCanalDaConversa(clinicaId, conversaId);
  if (!canal) return { ok: false, error: "canal_nao_encontrado" };

  for (let i = 0; i < blocos.length; i++) {
    if (i > 0) await esperar(1200);

    const envio = await enviarPeloCanal(canal, telefone, blocos[i]);
    if (!envio.ok) {
      console.error("[agentes] envio_failed", JSON.stringify({ conversaId, bloco: i, error: envio.error ?? null }));
      if (i === 0) return { ok: false, error: envio.error ?? "envio_falhou" };
      continue;
    }

    const { error: mensagemError } = await supabase.from("mensagens").insert({
      clinica_id: clinicaId,
      conversa_id: conversaId,
      direcao: "enviada",
      tipo: "texto",
      conteudo: blocos[i],
      evolution_message_id: envio.mensagemId ?? null,
      timestamp_whatsapp: new Date().toISOString(),
      gerada_por_agente_id: agenteId,
    });
    // unique(evolution_message_id): o webhook pode espelhar o eco da Evolution antes deste insert — idempotência, não erro.
    if (mensagemError && mensagemError.code !== "23505") {
      console.error("[agentes] insert_mensagem_failed", JSON.stringify({ conversaId, bloco: i, code: mensagemError.code ?? null }));
    }
  }

  return { ok: true };
}

/** Avança o funil como se a clínica tivesse respondido (fromMe=true) — mesma regra de decidirTransicaoWebhook. */
async function atualizarFunilAposResposta(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  clinicaId: string,
  conversaId: string,
  statusAtual: StatusConversa,
  motivoEvento: string,
  limparAgenteSeConcluido: boolean
) {
  const agora = new Date().toISOString();
  const decisao = decidirTransicaoWebhook(statusAtual, true);
  const concluiu = STATUS_RESOLVIDOS.includes(decisao.statusNovo);

  await supabase
    .from("conversas")
    .update({
      ultima_mensagem_em: agora,
      updated_at: agora,
      status: decisao.statusNovo,
      nao_lida: false,
      mensagens_nao_lidas: 0,
      // dono_conversa junto com agente_ativo_id na MESMA update, sempre —
      // nunca deixar as duas colunas desincronizarem (src/lib/dono-conversa.ts).
      ...(limparAgenteSeConcluido && concluiu ? { agente_ativo_id: null, dono_conversa: "humano" } : {}),
    })
    .eq("id", conversaId);

  if (decisao.evento) {
    await supabase.from("eventos_funil").insert({
      clinica_id: clinicaId,
      conversa_id: conversaId,
      status_anterior: decisao.evento.statusAnterior,
      status_novo: decisao.evento.statusNovo,
      motivo: motivoEvento,
    });
  }
}

/**
 * Orquestração chamada pelo webhook quando `deveResponder` diz sim: busca o
 * agente e o histórico, gera a resposta e manda pelo WhatsApp — mesmo
 * formato de reativacao.ts (ler → gerar/enviar → gravar), sempre isolada em
 * try/catch por quem chama (uma falha aqui nunca pode derrubar o webhook).
 *
 * `isNovoPaciente` vem do webhook (`!pacienteExistente`, já calculado ali) —
 * só usado pra decidir se dispara a notificação de "novo lead".
 */
export async function responderComoAgente(
  clinicaId: string,
  conversaId: string,
  mensagemRecebida: string,
  isNovoPaciente: boolean
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data: conversa } = await supabase
    .from("conversas")
    .select("id, telefone, status, agente_ativo_id, pacientes(nome, campanha_id)")
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (!conversa?.agente_ativo_id) return { ok: false, error: "sem_agente_ativo" };

  const agente = await buscarAgente(clinicaId, conversa.agente_ativo_id as string);
  if (!agente || !agente.ativo) return { ok: false, error: "agente_inativo" };

  const telefone = conversa.telefone as string;
  const statusAtual = isStatusValido(conversa.status as string) ? (conversa.status as StatusConversa) : "novo";
  const pacienteBruto = conversa.pacientes as
    | { nome: string | null; campanha_id: string | null }
    | { nome: string | null; campanha_id: string | null }[]
    | null;
  const pacienteRow = Array.isArray(pacienteBruto) ? pacienteBruto[0] : pacienteBruto;
  const pacienteNome = pacienteRow?.nome ?? null;
  const pacienteCampanhaId = pacienteRow?.campanha_id ?? null;
  const notifParams = { pacienteNome, telefone, resumo: mensagemRecebida };

  if (isNovoPaciente && agente.notificarNovoLead) {
    await notificarEquipe(agente, "novo_lead", notifParams);
  }
  if (isNovoPaciente) {
    await dispararPixelSeConfigurado(agente, "novo_lead", clinicaId, conversaId, telefone);
  }

  // Pedido de transferência: detecção por palavra-chave (determinística, sem
  // depender de a IA "entender" e sem parsing de marcador entre 5 provedores
  // diferentes) — se ligado, a IA nem é chamada, o humano assume na hora.
  if (agente.ativarTransferencia && detectarPedidoHumano(mensagemRecebida)) {
    const texto = agente.mensagemTransferencia?.trim() || MENSAGEM_TRANSFERENCIA_PADRAO;
    const envio = await enviarBlocos(supabase, clinicaId, conversaId, telefone, [texto], agente.id);
    if (!envio.ok) return envio;

    await liberarControle(clinicaId, conversaId, { agente_ativo_id: null });
    await atualizarFunilAposResposta(supabase, clinicaId, conversaId, statusAtual, "transferencia_para_humano", false);
    await notificarEquipe(agente, "pedido_humano", notifParams);
    return { ok: true };
  }

  if (agente.responderApenasHorario && !dentroDoHorario(horaAtualBrasilia(new Date()), agente.horarioInicio, agente.horarioFim)) {
    return { ok: true };
  }

  const modelo = buscarModelo(agente.provider, agente.modelo);
  if (!modelo) return { ok: false, error: "modelo_indisponivel" };

  let historico: MensagemHistorico[] = [];
  if (agente.incluirHistorico && agente.qtdHistorico > 0) {
    const { data: mensagens } = await supabase
      .from("mensagens")
      .select("direcao, conteudo")
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: false })
      .limit(agente.qtdHistorico);

    historico = (mensagens ?? [])
      .filter((m) => m.conteudo)
      .reverse()
      .map((m) => ({ direcao: m.direcao as "recebida" | "enviada", texto: m.conteudo as string }));
  }

  const conhecimento = await listarConhecimento(clinicaId, agente.id);

  // Campanhas: quando o paciente tem origem por campanha (vínculo manual —
  // ver src/lib/pacientes.ts), a IA sabe de onde o lead veio. Nunca falha o
  // envio se a campanha não existir mais/estiver cancelada.
  let contextoCampanha = "";
  if (pacienteCampanhaId) {
    const campanha = await buscarCampanha(clinicaId, pacienteCampanhaId);
    if (campanha) {
      contextoCampanha = `Origem: esta conversa começou pela campanha "${campanha.nome}" (objetivo: ${labelObjetivo(campanha.objetivo)}).`;
    }
  }

  const resposta = await gerarResposta(modelo, {
    promptSistema: [montarPromptSistema(agente, conhecimento), contextoCampanha].filter(Boolean).join("\n\n"),
    historico,
    mensagem: mensagemRecebida,
    temperatura: agente.temperatura,
    maxTokens: agente.maxTokens,
  });

  if (!resposta.ok || !resposta.texto) {
    console.error("[agentes] gerar_resposta_failed", JSON.stringify({ conversaId, error: resposta.error ?? null }));
    if (agente.notificarFallback) await notificarEquipe(agente, "fallback", notifParams);
    return { ok: false, error: resposta.error ?? "gerar_falhou" };
  }

  if (agente.notificarIntencaoCompra && detectarIntencaoCompra(mensagemRecebida)) {
    await notificarEquipe(agente, "intencao_compra", notifParams);
  }

  let textoFinal = resposta.texto;
  if (agente.maxCaracteresResposta && textoFinal.length > agente.maxCaracteresResposta) {
    textoFinal = textoFinal.slice(0, agente.maxCaracteresResposta).trim();
  }

  const blocos = agente.dividirEmMensagensCurtas ? dividirMensagem(textoFinal, agente.maxMensagensResposta) : [textoFinal];

  const envio = await enviarBlocos(supabase, clinicaId, conversaId, telefone, blocos, agente.id);
  if (!envio.ok) return envio;

  await atualizarFunilAposResposta(
    supabase,
    clinicaId,
    conversaId,
    statusAtual,
    "resposta_automatica_ia",
    agente.pausarAposConcluirFluxo
  );

  if (agente.qualificacaoAutomatica) {
    try {
      const classificacao = await classificarQualificacao(agente, historico, mensagemRecebida);
      if (classificacao) await aplicarQualificacaoAutomatica(clinicaId, conversaId, classificacao);
      if (classificacao === "quente") {
        await dispararPixelSeConfigurado(agente, "lead_quente", clinicaId, conversaId, telefone);
      }
    } catch (e) {
      console.error("[agentes] qualificacao_failed", JSON.stringify({ conversaId, message: (e as Error).message }));
    }
  }

  return { ok: true };
}

export type EstatisticasAgente = {
  mensagens: number;
  conversas: number;
  tempoMedioRespostaMs: number | null;
  conhecimentos: number;
};

/** Os 4 cards do cabeçalho de `/agentes/[id]` — dado de verdade, não decorativo. */
export async function buscarEstatisticasAgente(clinicaId: string, agenteId: string): Promise<EstatisticasAgente> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { mensagens: 0, conversas: 0, tempoMedioRespostaMs: null, conhecimentos: 0 };

  const [{ data: enviadas }, conhecimentos] = await Promise.all([
    supabase.from("mensagens").select("conversa_id").eq("clinica_id", clinicaId).eq("gerada_por_agente_id", agenteId),
    contarConhecimento(clinicaId, agenteId),
  ]);

  const conversaIds = Array.from(new Set((enviadas ?? []).map((m) => m.conversa_id as string)));
  const mensagens = enviadas?.length ?? 0;

  if (conversaIds.length === 0) {
    return { mensagens, conversas: 0, tempoMedioRespostaMs: null, conhecimentos };
  }

  const { data: relevantes } = await supabase
    .from("mensagens")
    .select("conversa_id, direcao, created_at, gerada_por_agente_id")
    .eq("clinica_id", clinicaId)
    .in("conversa_id", conversaIds)
    .or(`direcao.eq.recebida,gerada_por_agente_id.eq.${agenteId}`)
    .order("created_at", { ascending: true });

  const paraTempo: MensagemParaTempoResposta[] = (relevantes ?? []).map((m) => ({
    conversaId: m.conversa_id as string,
    direcao: m.direcao as "recebida" | "enviada",
    createdAt: m.created_at as string,
    geradaPorAgenteId: (m.gerada_por_agente_id as string | null) ?? null,
  }));

  return {
    mensagens,
    conversas: conversaIds.length,
    tempoMedioRespostaMs: calcularTempoMedioRespostaMs(paraTempo, agenteId),
    conhecimentos,
  };
}
