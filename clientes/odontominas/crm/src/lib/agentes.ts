import { getSupabaseServerClient } from "@/lib/supabase";
import { enviarMensagemWhatsapp } from "@/lib/evolution-send";
import { decidirTransicaoWebhook } from "@/lib/funil";
import { isStatusValido, type StatusConversa } from "@/lib/status";
import { buscarModelo, gerarResposta, type MensagemHistorico, type ProvedorId } from "@/lib/ia-provedores";

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
 * `max_mensagens_resposta` existe no schema mas ainda não parte a resposta
 * em várias bolhas do WhatsApp (fica pra quando isso virar prioridade —
 * mesmo espírito de `consultas` na Fase 4: campo pronto, comportamento
 * depois). `mensagem_transferencia` também é só armazenado por enquanto —
 * detectar intenção de "quero falar com humano" no texto do paciente é
 * lógica nova, fora do V1.
 */

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
  temperatura: number;
  maxTokens: number;
  maxMensagensResposta: number;
  incluirHistorico: boolean;
  qtdHistorico: number;
  pausarAoResponderHumano: boolean;
  tempoPausaMin: number;
  mensagemTransferencia: string | null;
};

export type DadosAgente = {
  nome: string;
  descricao?: string | null;
  etiquetaGatilhoId?: string | null;
  provider: ProvedorId;
  modelo: string;
  promptSistema?: string;
  temperatura?: number;
  maxTokens?: number;
  maxMensagensResposta?: number;
  incluirHistorico?: boolean;
  qtdHistorico?: number;
  pausarAoResponderHumano?: boolean;
  tempoPausaMin?: number;
  mensagemTransferencia?: string | null;
};

const SELECT_AGENTE =
  "id, clinica_id, nome, descricao, ativo, etiqueta_gatilho_id, provider, modelo, prompt_sistema, temperatura, max_tokens, max_mensagens_resposta, incluir_historico, qtd_historico, pausar_ao_responder_humano, tempo_pausa_min, mensagem_transferencia";

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
    temperatura: Number(row.temperatura),
    maxTokens: row.max_tokens,
    maxMensagensResposta: row.max_mensagens_resposta,
    incluirHistorico: row.incluir_historico,
    qtdHistorico: row.qtd_historico,
    pausarAoResponderHumano: row.pausar_ao_responder_humano,
    tempoPausaMin: row.tempo_pausa_min,
    mensagemTransferencia: row.mensagem_transferencia ?? null,
  };
}

function validarDados(dados: DadosAgente): string | null {
  if (!dados.nome?.trim()) return "nome_obrigatorio";
  if (!buscarModelo(dados.provider, dados.modelo)) return "modelo_invalido";
  if (dados.temperatura !== undefined && (dados.temperatura < 0 || dados.temperatura > 1)) return "temperatura_invalida";
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
    temperatura: dados.temperatura ?? 0.7,
    max_tokens: dados.maxTokens ?? 700,
    max_mensagens_resposta: dados.maxMensagensResposta ?? 3,
    incluir_historico: dados.incluirHistorico ?? true,
    qtd_historico: dados.qtdHistorico ?? 10,
    pausar_ao_responder_humano: dados.pausarAoResponderHumano ?? true,
    tempo_pausa_min: dados.tempoPausaMin ?? 480,
    mensagem_transferencia: dados.mensagemTransferencia?.trim() || null,
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
    temperatura: dados.temperatura ?? atual.temperatura,
    maxTokens: dados.maxTokens ?? atual.maxTokens,
    maxMensagensResposta: dados.maxMensagensResposta ?? atual.maxMensagensResposta,
    incluirHistorico: dados.incluirHistorico ?? atual.incluirHistorico,
    qtdHistorico: dados.qtdHistorico ?? atual.qtdHistorico,
    pausarAoResponderHumano: dados.pausarAoResponderHumano ?? atual.pausarAoResponderHumano,
    tempoPausaMin: dados.tempoPausaMin ?? atual.tempoPausaMin,
    mensagemTransferencia: dados.mensagemTransferencia !== undefined ? dados.mensagemTransferencia : atual.mensagemTransferencia,
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

  return criarAgente(clinicaId, {
    nome: `${original.nome} (cópia)`,
    descricao: original.descricao,
    etiquetaGatilhoId: original.etiquetaGatilhoId,
    provider: original.provider,
    modelo: original.modelo,
    promptSistema: original.promptSistema,
    temperatura: original.temperatura,
    maxTokens: original.maxTokens,
    maxMensagensResposta: original.maxMensagensResposta,
    incluirHistorico: original.incluirHistorico,
    qtdHistorico: original.qtdHistorico,
    pausarAoResponderHumano: original.pausarAoResponderHumano,
    tempoPausaMin: original.tempoPausaMin,
    mensagemTransferencia: original.mensagemTransferencia,
  });
}

/** Etiqueta acabou de ser aplicada numa conversa: qual agente ativo (se algum) deve passar a escutar essa conversa. */
export function decidirAtivarAgentePorEtiqueta(agentes: AgenteIA[], etiquetaId: string): AgenteIA | null {
  return agentes.find((a) => a.ativo && a.etiquetaGatilhoId === etiquetaId) ?? null;
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
 * Orquestração chamada pelo webhook quando `deveResponder` diz sim: busca o
 * agente e o histórico, gera a resposta e manda pelo WhatsApp — mesmo
 * formato de reativacao.ts (ler → gerar/enviar → gravar), sempre isolada em
 * try/catch por quem chama (uma falha aqui nunca pode derrubar o webhook).
 */
export async function responderComoAgente(
  clinicaId: string,
  conversaId: string,
  mensagemRecebida: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data: conversa } = await supabase
    .from("conversas")
    .select("id, telefone, status, agente_ativo_id")
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (!conversa?.agente_ativo_id) return { ok: false, error: "sem_agente_ativo" };

  const agente = await buscarAgente(clinicaId, conversa.agente_ativo_id as string);
  if (!agente || !agente.ativo) return { ok: false, error: "agente_inativo" };

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

  const resposta = await gerarResposta(modelo, {
    promptSistema: agente.promptSistema,
    historico,
    mensagem: mensagemRecebida,
    temperatura: agente.temperatura,
    maxTokens: agente.maxTokens,
  });

  if (!resposta.ok || !resposta.texto) {
    console.error("[agentes] gerar_resposta_failed", JSON.stringify({ conversaId, error: resposta.error ?? null }));
    return { ok: false, error: resposta.error ?? "gerar_falhou" };
  }

  const envio = await enviarMensagemWhatsapp(conversa.telefone as string, resposta.texto);
  if (!envio.ok) {
    console.error("[agentes] envio_failed", JSON.stringify({ conversaId, error: envio.error ?? null }));
    return { ok: false, error: envio.error ?? "envio_falhou" };
  }

  const agora = new Date().toISOString();
  const statusAtual = isStatusValido(conversa.status as string) ? (conversa.status as StatusConversa) : "novo";
  const decisao = decidirTransicaoWebhook(statusAtual, true);

  await supabase
    .from("conversas")
    .update({
      ultima_mensagem_em: agora,
      updated_at: agora,
      status: decisao.statusNovo,
      nao_lida: false,
      mensagens_nao_lidas: 0,
    })
    .eq("id", conversaId);

  if (decisao.evento) {
    await supabase.from("eventos_funil").insert({
      clinica_id: clinicaId,
      conversa_id: conversaId,
      status_anterior: decisao.evento.statusAnterior,
      status_novo: decisao.evento.statusNovo,
      motivo: "resposta_automatica_ia",
    });
  }

  const { error: mensagemError } = await supabase.from("mensagens").insert({
    clinica_id: clinicaId,
    conversa_id: conversaId,
    direcao: "enviada",
    tipo: "texto",
    conteudo: resposta.texto,
    evolution_message_id: envio.mensagemId ?? null,
    timestamp_whatsapp: agora,
    gerada_por_agente_id: agente.id,
  });
  // unique(evolution_message_id): o webhook pode espelhar o eco da Evolution antes deste insert — idempotência, não erro.
  if (mensagemError && mensagemError.code !== "23505") {
    console.error("[agentes] insert_mensagem_failed", JSON.stringify({ conversaId, code: mensagemError.code ?? null }));
  }

  return { ok: true };
}
