import { getSupabaseServerClient } from "@/lib/supabase";
import { registrarEvento } from "@/lib/auditoria";
import { atualizarStatus, extrairNomeEmbutido, type NomeEmbutido } from "@/lib/conversas";
import { enviarPeloCanal, mensagemErroEnvio } from "@/lib/canais-envio";
import { buscarCanalDaConversa, buscarCanalPorId, buscarCanalPrincipal } from "@/lib/canais";
import { assumirConversa, decidirEnvioHumano, registrarEventoConversa, type AtorConversa } from "@/lib/atribuicao";
import { garantirOportunidadeDaConversa } from "@/lib/kanban";
import { decidirTransicaoWebhook } from "@/lib/funil";
import { pausarAgenteManual, pausarAgenteSeConfigurado } from "@/lib/agentes";
import { transferirExecucaoAtivaParaHumano } from "@/lib/fluxo-execucoes";
import { isPrioridadeValida, type Prioridade } from "@/lib/prioridade";
import { isStatusValido, STATUS_RESOLVIDOS, type StatusConversa } from "@/lib/status";
import { derivarStatusOperacional, type ConversaChat, type MensagemChat } from "@/lib/chat-filtros";
import { canonicalizarTelefoneBr, encontrarPorTelefoneEquivalente, variantesEquivalentesTelefoneBr } from "@/lib/telefone";

/**
 * Chat ao Vivo — inbox estilo RoiZap (a pedido do Rafael, 2026-09-15): lista
 * de conversas com busca/filtro/etiqueta + thread com envio real pelo
 * painel. Reaproveita o que já existe (funil, envio Evolution, sessão de
 * atendente) em vez de duplicar — enviarRespostaChat espelha exatamente o
 * padrão de src/lib/reativacao.ts (enviar → gravar → idempotência por
 * evolution_message_id) mais a transição de funil que o webhook já aplica
 * pra mensagem `fromMe`.
 *
 * "Concluído" no chat reaproveita STATUS_RESOLVIDOS do funil (não é um
 * campo novo) — evita dois conceitos de "resolvido" divergindo com o tempo.
 */

function previewConteudo(tipo: string, conteudo: string | null): string {
  if (conteudo) return conteudo;
  const rotulos: Record<string, string> = {
    imagem: "📷 Imagem",
    video: "🎥 Vídeo",
    audio: "🎵 Áudio",
    audio_voz: "🎤 Áudio",
    documento: "📄 Documento",
    figurinha: "Figurinha",
    localizacao: "📍 Localização",
    reacao: "Reação",
  };
  return rotulos[tipo] ?? "Mensagem";
}

/**
 * Visibilidade (RBAC): `conversas.visualizar_todas` vê tudo; só
 * `visualizar_proprias` vê as PRÓPRIAS mais a fila sem responsável (senão a
 * atendente nunca enxergaria o que assumir); sem nenhuma das duas, nada.
 */
export async function listarConversasChat(clinicaId: string, ator?: AtorConversa | null): Promise<ConversaChat[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  if (ator && !ator.permissoes.has("conversas.visualizar_todas") && !ator.permissoes.has("conversas.visualizar_proprias")) return [];

  let consulta = supabase
    .from("conversas")
    .select(
      "id, telefone, status, prioridade, nao_lida, mensagens_nao_lidas, arquivada, atribuido_a, atribuido_em, canal_id, finalizada_em, dono_conversa, ultima_mensagem_em, paciente_id, agente_ativo_id, pacientes(nome), atendentes(nome), canais(nome)"
    )
    .eq("clinica_id", clinicaId);
  if (ator && !ator.permissoes.has("conversas.visualizar_todas")) {
    consulta = consulta.or(`atribuido_a.is.null,atribuido_a.eq.${ator.atendenteId}`);
  }
  const { data: conversas, error } = await consulta;

  if (error || !conversas) {
    console.error("[chat] listar_failed", JSON.stringify({ code: (error as { code?: string })?.code ?? null }));
    return [];
  }

  const ids = conversas.map((c) => c.id as string);
  if (ids.length === 0) return [];

  const [{ data: mensagens }, { data: etiquetasLinks }] = await Promise.all([
    // RPC (DISTINCT ON): 1 linha por conversa, em vez de baixar o histórico inteiro da clínica.
    supabase.rpc("conversas_ultima_mensagem", { p_clinica: clinicaId }),
    supabase
      .from("conversa_etiquetas")
      .select("conversa_id, etiquetas(id, nome, cor)")
      .in("conversa_id", ids),
  ]);

  const ultimaPorConversa = new Map<string, { direcao: "recebida" | "enviada"; tipo: string; conteudo: string | null }>();
  for (const m of (mensagens ?? []) as Record<string, unknown>[]) {
    const conversaId = m.conversa_id as string;
    if (!ultimaPorConversa.has(conversaId)) {
      ultimaPorConversa.set(conversaId, {
        direcao: m.direcao as "recebida" | "enviada",
        tipo: m.tipo as string,
        conteudo: m.conteudo as string | null,
      });
    }
  }

  type EtiquetaEmbutida = { id: string; nome: string; cor: string } | { id: string; nome: string; cor: string }[] | null;
  const etiquetasPorConversa = new Map<string, { id: string; nome: string; cor: string }[]>();
  for (const row of etiquetasLinks ?? []) {
    const conversaId = row.conversa_id as string;
    const bruto = row.etiquetas as EtiquetaEmbutida;
    const etiqueta = Array.isArray(bruto) ? bruto[0] : bruto;
    if (!etiqueta) continue;
    if (!etiquetasPorConversa.has(conversaId)) etiquetasPorConversa.set(conversaId, []);
    etiquetasPorConversa.get(conversaId)!.push(etiqueta);
  }

  const resultado: ConversaChat[] = conversas.map((c) => {
    const id = c.id as string;
    const statusBruto = c.status as string;
    const prioridadeBruta = c.prioridade as string;
    const ultima = ultimaPorConversa.get(id) ?? null;

    return {
      id,
      telefone: c.telefone as string,
      pacienteId: (c.paciente_id as string | null | undefined) ?? null,
      pacienteNome: extrairNomeEmbutido(c.pacientes as NomeEmbutido),
      status: isStatusValido(statusBruto) ? statusBruto : "novo",
      prioridade: isPrioridadeValida(prioridadeBruta) ? prioridadeBruta : "normal",
      naoLida: c.nao_lida as boolean,
      mensagensNaoLidas: (c.mensagens_nao_lidas as number | null) ?? 0,
      arquivada: c.arquivada as boolean,
      atribuidoAId: (c.atribuido_a as string | null | undefined) ?? null,
      atribuidoANome: extrairNomeEmbutido(c.atendentes as NomeEmbutido),
      atribuidoEm: (c.atribuido_em as string | null | undefined) ?? null,
      canalId: (c.canal_id as string | null | undefined) ?? null,
      canalNome: extrairNomeEmbutido(c.canais as NomeEmbutido),
      finalizadaEm: (c.finalizada_em as string | null | undefined) ?? null,
      statusOperacional: derivarStatusOperacional(
        isStatusValido(statusBruto) ? statusBruto : "novo",
        (c.finalizada_em as string | null | undefined) ?? null
      ),
      donoConversa: ((c.dono_conversa as string | null) ?? "humano") as ConversaChat["donoConversa"],
      ultimaMensagemEm: c.ultima_mensagem_em as string | null,
      ultimaMensagemPreview: ultima ? previewConteudo(ultima.tipo, ultima.conteudo) : null,
      ultimaMensagemDirecao: ultima?.direcao ?? null,
      etiquetas: etiquetasPorConversa.get(id) ?? [],
      agenteAtivoId: (c.agente_ativo_id as string | null | undefined) ?? null,
    };
  });

  resultado.sort((a, b) => new Date(b.ultimaMensagemEm ?? 0).getTime() - new Date(a.ultimaMensagemEm ?? 0).getTime());

  return resultado;
}

export async function buscarMensagensChat(clinicaId: string, conversaId: string): Promise<MensagemChat[] | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data: conversa } = await supabase
    .from("conversas")
    .select("id")
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (!conversa) return null;

  const { data, error } = await supabase
    .from("mensagens")
    .select("id, direcao, tipo, conteudo, timestamp_whatsapp, created_at")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((m) => ({
    id: m.id as string,
    direcao: m.direcao as "recebida" | "enviada",
    tipo: m.tipo as string,
    conteudo: m.conteudo as string | null,
    quando: (m.timestamp_whatsapp as string | null) ?? (m.created_at as string),
  }));
}

export type ResultadoEnvioChat = {
  ok: boolean;
  error?: string;
  /** Mensagem operacional em português, pronta pra UI (canal pausado/desconectado, conflito de responsável…). */
  mensagemErro?: string;
  porNome?: string | null;
  mensagem?: MensagemChat;
};

/**
 * `ator` = quem responde. Enforcement no BACKEND (não só o botão): responsável
 * envia; conversa sem responsável é assumida na mesma operação atômica (quem
 * perde a corrida recebe conflito); conversa de outra pessoa só com
 * `conversas.intervir` (auditado); conversa finalizada só com `conversas.reabrir`.
 * `ator = null` é reservado a chamadas internas de sistema.
 */
export async function enviarRespostaChat(
  clinicaId: string,
  conversaId: string,
  textoBruto: string,
  ator: AtorConversa | null
): Promise<ResultadoEnvioChat> {
  const atendenteId = ator?.atendenteId ?? null;
  const texto = textoBruto.trim();
  if (!texto) return { ok: false, error: "texto_vazio" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data: conversa, error: erroConversa } = await supabase
    .from("conversas")
    .select("id, telefone, status, agente_ativo_id, dono_conversa, atribuido_a, finalizada_em, canal_id")
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (erroConversa || !conversa) return { ok: false, error: "not_found" };

  const atribuidoAtual = (conversa.atribuido_a as string | null) ?? null;
  let interveio = false;

  if (ator) {
    if (conversa.finalizada_em && !ator.permissoes.has("conversas.reabrir")) {
      return { ok: false, error: "conversa_finalizada", mensagemErro: "Esta conversa foi finalizada. Só quem tem permissão de reabrir pode responder." };
    }

    const decisao = decidirEnvioHumano(ator, atribuidoAtual);
    if (decisao === "negado") {
      return { ok: false, error: "nao_e_responsavel", mensagemErro: "Esta conversa está com outra pessoa. Peça a ela para transferir, ou peça a alguém com permissão de intervir." };
    }
    if (decisao === "intervir") interveio = true;
    if (decisao === "assumir_e_enviar") {
      const assumida = await assumirConversa(clinicaId, conversaId, ator);
      if (!assumida.ok) {
        return {
          ok: false,
          error: assumida.error,
          porNome: assumida.porNome ?? null,
          mensagemErro: assumida.error === "ja_assumida" ? `Esta conversa acabou de ser assumida por ${assumida.porNome ?? "outra pessoa"}.` : undefined,
        };
      }
    }
  }

  // Conversa → canal → instância: nunca instância global, nunca outro número.
  const canal = await buscarCanalDaConversa(clinicaId, conversaId);
  if (!canal) return { ok: false, error: "canal_nao_encontrado", mensagemErro: mensagemErroEnvio("canal_nao_encontrado") };

  const envio = await enviarPeloCanal(canal, conversa.telefone as string, texto);
  if (!envio.ok) return { ok: false, error: envio.error ?? "envio_falhou", mensagemErro: mensagemErroEnvio(envio.error) };

  if (interveio) {
    await registrarEventoConversa(clinicaId, conversaId, "CONVERSATION_INTERVENED", atendenteId, { canalId: canal.id, deAtendenteId: atribuidoAtual });
    await registrarEvento({ clinicaId, atorId: atendenteId, atorPerfil: ator?.perfil ?? null, evento: "CONVERSATION_INTERVENED", alvoId: conversaId, detalhes: { responsavel: atribuidoAtual } });
  }

  // Atendente respondeu na mão: se um agente de IA estiver escutando essa
  // conversa e configurado pra pausar nesse caso, entra em espera — nunca
  // bloqueia o envio em si se isso falhar.
  await pausarAgenteSeConfigurado(clinicaId, conversaId, (conversa.agente_ativo_id as string | null) ?? null);

  // Mesma ideia, pro Fluxo de Conversa: sem isso, uma `espera` de dias
  // continuaria mandando mensagem automática por cima do humano que acabou
  // de responder — a execução em si precisa ir pra `transferred`, não só o
  // roteador `dono_conversa` (ver src/lib/fluxo-execucoes.ts).
  if ((conversa.dono_conversa as string | null) === "fluxo") {
    await transferirExecucaoAtivaParaHumano(clinicaId, conversaId, "resposta_manual_chat");
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
      finalizada_em: null,
    })
    .eq("id", conversaId);
  if (conversa.finalizada_em) await registrarEventoConversa(clinicaId, conversaId, "CONVERSATION_REOPENED", atendenteId, { canalId: canal.id });

  if (decisao.evento) {
    // motivo "manual" (não o motivo automático de decidirTransicaoWebhook) de propósito:
    // é o mesmo valor que src/lib/conversas.ts usa pra troca manual — conta como
    // atendimento na Equipe (src/lib/equipe.ts filtra eventos_funil por motivo="manual").
    await supabase.from("eventos_funil").insert({
      clinica_id: clinicaId,
      conversa_id: conversaId,
      status_anterior: decisao.evento.statusAnterior,
      status_novo: decisao.evento.statusNovo,
      motivo: "manual",
      atendente_id: atendenteId,
    });
  }

  const { data: mensagemInserida, error: mensagemError } = await supabase
    .from("mensagens")
    .insert({
      clinica_id: clinicaId,
      conversa_id: conversaId,
      direcao: "enviada",
      tipo: "texto",
      conteudo: texto,
      evolution_message_id: envio.mensagemId ?? null,
      timestamp_whatsapp: agora,
      // Único ponto do projeto que marca autoria humana em `mensagens` — é o
      // que distingue resposta humana de Fluxo/disparo/reativação pro SLA
      // (src/lib/sla.ts). `atendenteId` pode ser null (iniciarConversaChat
      // chama esta função sem sessão, ao abrir uma conversa nova pelo
      // painel) — nesse caso a mensagem simplesmente não conta como
      // resposta humana pro SLA.
      enviada_por_atendente_id: atendenteId,
    })
    .select("id, direcao, tipo, conteudo, timestamp_whatsapp")
    .single();

  if (mensagemError) {
    // unique(evolution_message_id): o webhook pode ter espelhado o eco da própria
    // Evolution API antes deste insert rodar — não é erro, é a mesma idempotência
    // de src/lib/reativacao.ts.
    if (mensagemError.code === "23505") {
      return { ok: true };
    }
    console.error("[chat] insert_mensagem_failed", JSON.stringify({ conversaId, code: mensagemError.code ?? null }));
    return { ok: true };
  }

  return {
    ok: true,
    mensagem: {
      id: mensagemInserida.id as string,
      direcao: "enviada",
      tipo: "texto",
      conteudo: texto,
      quando: agora,
    },
  };
}

export type PatchConversaChat = {
  arquivada?: boolean;
  prioridade?: Prioridade;
  naoLida?: boolean;
};

export async function atualizarConversaChat(
  clinicaId: string,
  conversaId: string,
  patch: PatchConversaChat
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.arquivada !== undefined) payload.arquivada = patch.arquivada;
  if (patch.naoLida !== undefined) {
    payload.nao_lida = patch.naoLida;
    // Marcar como lida (abrir a conversa no painel) zera a contagem também —
    // só reabre por mensagem nova de verdade (webhook incrementa de novo).
    if (!patch.naoLida) payload.mensagens_nao_lidas = 0;
  }
  if (patch.prioridade !== undefined) {
    if (!isPrioridadeValida(patch.prioridade)) return { ok: false, error: "prioridade_invalida" };
    payload.prioridade = patch.prioridade;
  }

  const { error } = await supabase
    .from("conversas")
    .update(payload)
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId);

  if (error) {
    console.error("[chat] atualizar_failed", JSON.stringify({ conversaId, code: error.code ?? null }));
    return { ok: false, error: error.code === "23503" ? "atendente_invalido" : "update_failed" };
  }

  return { ok: true };
}

/**
 * "11987654321" ou "(11) 98765-4321" → "5511987654321". Aceita já-com-DDI
 * também. Delega a equivalência de 9º dígito do celular BR (mesmo bug real
 * achado no webhook, 2026-09-18) pra `telefone.ts` — central única, nunca
 * duplicada aqui.
 */
export function normalizarTelefoneEntrada(bruto: string): string | null {
  const digitos = bruto.replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length === 10 || digitos.length === 11) return canonicalizarTelefoneBr(`55${digitos}`);
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) return canonicalizarTelefoneBr(digitos);
  return null;
}

export async function iniciarConversaChat(
  clinicaId: string,
  telefoneBruto: string,
  textoBruto: string,
  nomeOpcional: string | null,
  ator: AtorConversa | null = null,
  canalIdSolicitado: string | null = null
): Promise<ResultadoEnvioChat & { conversaId?: string }> {
  const telefone = normalizarTelefoneEntrada(telefoneBruto);
  if (!telefone) return { ok: false, error: "telefone_invalido" };

  const texto = textoBruto.trim();
  if (!texto) return { ok: false, error: "texto_vazio" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  // Compatibilidade de transição (achado real 2026-09-18, ver telefone.ts):
  // um registro legado pode ter sido gravado sem o 9º dígito do celular BR.
  // Busca por qualquer forma equivalente antes de decidir criar, sem nunca
  // reescrever o valor já gravado.
  const variantesTelefone = variantesEquivalentesTelefoneBr(telefone);

  const { data: pacientesEncontrados } = await supabase
    .from("pacientes")
    .select("id, telefone")
    .eq("clinica_id", clinicaId)
    .in("telefone", variantesTelefone);

  let pacienteId = encontrarPorTelefoneEquivalente(pacientesEncontrados ?? [], telefone)?.id as string | undefined;
  if (!pacienteId) {
    const { data: novoPaciente, error } = await supabase
      .from("pacientes")
      .insert({ clinica_id: clinicaId, telefone, nome: nomeOpcional?.trim() || null })
      .select("id")
      .single();
    if (error || !novoPaciente) return { ok: false, error: "persist_failed" };
    pacienteId = novoPaciente.id as string;
  }

  // Canal: o pedido só vale se pertencer à clínica (validado aqui, nunca confiado); sem pedido, o principal.
  const canal = canalIdSolicitado ? await buscarCanalPorId(clinicaId, canalIdSolicitado) : await buscarCanalPrincipal(clinicaId);
  if (!canal) return { ok: false, error: "canal_nao_encontrado", mensagemErro: mensagemErroEnvio("canal_nao_encontrado") };

  const { data: conversasEncontradas } = await supabase
    .from("conversas")
    .select("id, telefone")
    .eq("clinica_id", clinicaId)
    .eq("canal_id", canal.id)
    .in("telefone", variantesTelefone);

  let conversaId = encontrarPorTelefoneEquivalente(conversasEncontradas ?? [], telefone)?.id as string | undefined;
  const agora = new Date().toISOString();
  const conversaNova = !conversaId;

  if (!conversaId) {
    const { data: novaConversa, error } = await supabase
      .from("conversas")
      .insert({
        clinica_id: clinicaId,
        paciente_id: pacienteId,
        telefone,
        canal_id: canal.id,
        instancia_evolution: canal.providerInstanceId,
        status: "respondido",
        primeira_mensagem_em: agora,
        ultima_mensagem_em: agora,
        aguardando_desde: agora,
        nao_lida: false,
        // Quem abre a conversa pelo painel é a responsável (não cai na fila de ninguém).
        ...(ator ? { atribuido_a: ator.atendenteId, atribuido_em: agora } : {}),
      })
      .select("id")
      .single();
    if (error || !novaConversa) return { ok: false, error: "persist_failed" };
    conversaId = novaConversa.id as string;
  }

  await garantirOportunidadeDaConversa(clinicaId, pacienteId, conversaId, { conversaNova, atorId: ator?.atendenteId ?? null });

  // Reaproveita o motor de envio da conversa já existente — mesmo comportamento
  // do webhook/funil, sem duplicar a lógica de transição aqui.
  const resultado = await enviarRespostaChat(clinicaId, conversaId, texto, ator);
  if (!resultado.ok) return { ...resultado, conversaId };

  return { ok: true, conversaId };
}

/**
 * Chamada em src/app/(painel)/layout.tsx — toda tela logada, não só o Chat.
 * Nunca deixa a migração v6 ainda não rodada derrubar o painel inteiro:
 * degrada pra 0 e loga, mesmo padrão de listarConversasChat.
 */
export async function contarNaoLidas(clinicaId: string): Promise<number> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return 0;

  const { count, error } = await supabase
    .from("conversas")
    .select("id", { count: "exact", head: true })
    .eq("clinica_id", clinicaId)
    .eq("nao_lida", true)
    .eq("arquivada", false);

  if (error) {
    console.error("[chat] contar_nao_lidas_failed", JSON.stringify({ code: error.code ?? null }));
    return 0;
  }

  return count ?? 0;
}

/**
 * "Finalizar Atendimento" no Chat ao Vivo (a pedido do Rafael): um clique só
 * pra encerrar — leva a conversa pra um status resolvido (sem regredir um
 * status já resolvido mais específico, como agendado/perdido, de volta pra
 * "respondido") e desliga a IA da conversa (pausarAgenteManual).
 */
export async function finalizarAtendimento(
  clinicaId: string,
  conversaId: string,
  atendenteId: string | null
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data: conversa } = await supabase
    .from("conversas")
    .select("status, canal_id")
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (!conversa) return { ok: false, error: "not_found" };

  const statusAtual = isStatusValido(conversa.status as string) ? (conversa.status as StatusConversa) : "novo";
  if (!STATUS_RESOLVIDOS.includes(statusAtual)) {
    await atualizarStatus(clinicaId, conversaId, "respondido", atendenteId);
  }

  await pausarAgenteManual(clinicaId, conversaId);

  // "Finalizada" operacional (separa de "respondido = aguardando paciente"); o
  // webhook limpa quando o paciente escrever de novo.
  await supabase.from("conversas").update({ finalizada_em: new Date().toISOString() }).eq("id", conversaId).eq("clinica_id", clinicaId);
  await registrarEventoConversa(clinicaId, conversaId, "CONVERSATION_CLOSED", atendenteId, { canalId: (conversa.canal_id as string | null) ?? null });

  return { ok: true };
}

// Compat: quem já importava tipos/filtros de "@/lib/chat" continua funcionando.
export * from "@/lib/chat-filtros";
