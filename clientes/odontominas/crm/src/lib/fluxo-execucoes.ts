import { getSupabaseServerClient } from "@/lib/supabase";
import { assumirControle, liberarControle } from "@/lib/dono-conversa";
import { enviarPeloCanal, enviarPeloCanalPrincipal, isErroDeCanal } from "@/lib/canais-envio";
import { abrirAlertaPorEvento } from "@/lib/alertas";
import { buscarCanalDaConversa } from "@/lib/canais";
import { atribuirPorAutomacao } from "@/lib/atribuicao";
import { encontrarNoInicio, validarFormaDefinicao, type FluxoDefinicao } from "@/lib/fluxo-tipos";
import { processarNo, type AcaoCrm, type ContadoresNo, type ContextoPaciente, type EntradaProcessamento } from "@/lib/fluxo-motor";
import { combinaGatilhoMensagem, dedupeKeyParaGatilho } from "@/lib/fluxo-gatilhos";
import { adicionarEtiquetaConversa, removerEtiquetaConversa } from "@/lib/etiquetas";
import { atualizarStatus } from "@/lib/conversas";
import { isPrioridadeValida } from "@/lib/prioridade";
import { buscarAgente } from "@/lib/agentes";
import { getClinicaId } from "@/lib/clinica";
import { automacoesComerciaisHabilitadas, carregarVariaveisComerciais, type ContextoComercial } from "@/lib/fluxo-comercial";
import { obterOuCriarConversaDoPaciente } from "@/lib/conversas";
import { avaliarHorarioAtendimento, calcularProximoHorario, buscarConfiguracaoHorario } from "@/lib/horario-atendimento";
import { classificarNps } from "@/lib/nps";
import { buscarConfigReputacao } from "@/lib/reputacao-config";
import { calcularExpiracaoToken, gerarTrackingToken, montarUrlRastreavel } from "@/lib/reputacao-tracking";

/**
 * Camada de I/O do motor de Fluxo de Conversa (Fase 2a — ver
 * crm/docs/fluxo-conversa-arquitetura.md). Sem teste direto, mesmo critério
 * de `disparos-worker.ts`/`agentes.ts:responderComoAgente` — a lógica pura
 * fica em `fluxo-motor.ts`/`fluxo-validador.ts`, testada exaustivamente lá.
 *
 * Claim SEM CTE/RPC de propósito: este projeto nunca usou função de banco
 * (só a query builder do Supabase) — introduzir isso só pra esta feature
 * quebraria o padrão em todo o resto do código. Em vez de uma CTE atômica
 * (claim+insert do evento num só statement), o claim é uma `UPDATE`
 * condicional otimista (`WHERE id=$1 AND estado=<valor lido antes>` —
 * mesma serialização por lock de linha do Postgres que já vale pra qualquer
 * `UPDATE ... WHERE` disputado, sem precisar de mecanismo novo). A janela
 * residual (processo morrer entre a `UPDATE` de claim e o `INSERT` do evento,
 * deixando `estado='running'` sem evento correspondente) é fechada por uma
 * 2ª varredura de recovery, direto em `fluxo_execucoes` — ver `fluxo-worker.ts`.
 */

type SupabaseClient = NonNullable<ReturnType<typeof getSupabaseServerClient>>;

/**
 * Aplica o efeito de um bloco de Ações CRM/Humano+IA contra o banco (e, pro
 * alerta interno, o WhatsApp). `atribuido_a`/`prioridade` são escritos direto
 * aqui (não via `chat.ts:atualizarConversaChat`) de propósito: `chat.ts` já
 * importa `transferirExecucaoAtivaParaHumano` deste mesmo arquivo — reusar a
 * função de lá criaria um ciclo de import (`fluxo-execucoes.ts` → `chat.ts` →
 * `fluxo-execucoes.ts`). `mudar_status` e as duas de etiqueta reusam as libs
 * existentes (`conversas.ts`/`etiquetas.ts`), que não têm esse problema —
 * inclusive dando de graça o Pixel de Conversão/evento de Campanha já
 * ligados a `atualizarStatus`. Nunca deixa uma falha aqui derrubar o passo do
 * fluxo: só loga, mesmo critério de envio de mensagem.
 *
 * `donoTransferido: true` só na ÚNICA ação que muda `dono_conversa` ela
 * mesma (`iniciar_agente_ia`, com sucesso) — é o sinal que
 * `processarPassoReivindicado` usa pra NÃO chamar o `liberarControle`
 * genérico (que devolveria a conversa pro humano por cima da entrega que
 * acabou de acontecer pro agente). Toda outra ação devolve `false`, mesmo as
 * que nem tocam `dono_conversa`.
 *
 * `variaveisExtra` (Fase 3, pesquisas) — só `criar_pesquisa` usa: o
 * `pesquisa_id` só existe depois do INSERT (gerado pelo banco), então não dá
 * pra vir de `resultado.variaveisAtualizadas` do motor puro (que nunca toca
 * banco). `processarPassoReivindicado` funde isso nas variáveis da execução
 * do mesmo jeito que funde `resultado.variaveisAtualizadas`.
 */
async function aplicarAcaoCrm(
  supabase: SupabaseClient,
  clinicaId: string,
  conversaId: string,
  contexto: { pacienteId: string | null; fluxoId: string; execucaoId: string; variaveis: Record<string, string> },
  acao: AcaoCrm
): Promise<{ donoTransferido: boolean; variaveisExtra?: Record<string, string> }> {
  switch (acao.tipo) {
    case "acao_comercial": throw new Error("acao_comercial_exige_contexto");
    case "adicionar_etiqueta": {
      if (!acao.etiquetaId) return { donoTransferido: false }; // nó publicado sem etiqueta não deveria existir (validarGrafo barra), defesa extra
      const resultado = await adicionarEtiquetaConversa(clinicaId, conversaId, acao.etiquetaId);
      if (!resultado.ok) {
        console.error("[fluxo-execucoes] acao_crm_falhou", JSON.stringify({ acao: acao.tipo, conversaId, error: resultado.error ?? null }));
      }
      return { donoTransferido: false };
    }
    case "remover_etiqueta": {
      if (!acao.etiquetaId) return { donoTransferido: false };
      await removerEtiquetaConversa(conversaId, acao.etiquetaId);
      return { donoTransferido: false };
    }
    case "mudar_status": {
      const resultado = await atualizarStatus(clinicaId, conversaId, acao.status);
      if (!resultado.ok) {
        console.error("[fluxo-execucoes] acao_crm_falhou", JSON.stringify({ acao: acao.tipo, conversaId, error: resultado.error ?? null }));
      }
      return { donoTransferido: false };
    }
    case "marcar_prioridade": {
      if (!isPrioridadeValida(acao.prioridade)) return { donoTransferido: false };
      const { error } = await supabase
        .from("conversas")
        .update({ prioridade: acao.prioridade, updated_at: new Date().toISOString() })
        .eq("id", conversaId)
        .eq("clinica_id", clinicaId);
      if (error) console.error("[fluxo-execucoes] acao_crm_falhou", JSON.stringify({ acao: acao.tipo, conversaId, code: error.code ?? null }));
      return { donoTransferido: false };
    }
    case "atribuir_atendente": {
      // Mesma RPC atômica da caixa compartilhada (com histórico) — nunca UPDATE solto.
      if (acao.atendenteId === null) {
        await supabase
          .from("conversas")
          .update({ atribuido_a: null, atribuido_em: null, updated_at: new Date().toISOString() })
          .eq("id", conversaId)
          .eq("clinica_id", clinicaId);
        return { donoTransferido: false };
      }
      const atribuicao = await atribuirPorAutomacao(clinicaId, conversaId, acao.atendenteId);
      if (!atribuicao.ok) console.error("[fluxo-execucoes] acao_crm_falhou", JSON.stringify({ acao: acao.tipo, conversaId }));
      return { donoTransferido: false };
    }
    case "criar_alerta_interno": {
      const numeros = acao.numeros
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      for (const numero of numeros) {
        const envio = await enviarPeloCanalPrincipal(clinicaId, numero, acao.mensagem);
        if (!envio.ok) {
          console.error("[fluxo-execucoes] acao_crm_falhou", JSON.stringify({ acao: acao.tipo, conversaId, numero, error: envio.error ?? null }));
        }
      }
      return { donoTransferido: false };
    }
    case "pausar_automacao": {
      // Só neutraliza o agente (pra não retomar sozinho depois) — nunca toca
      // dono_conversa: o fluxo continua dono, ainda vai processar o próximo nó.
      const { error } = await supabase
        .from("conversas")
        .update({ agente_ativo_id: null, agente_pausado_ate: null, updated_at: new Date().toISOString() })
        .eq("id", conversaId)
        .eq("clinica_id", clinicaId);
      if (error) console.error("[fluxo-execucoes] acao_crm_falhou", JSON.stringify({ acao: acao.tipo, conversaId, code: error.code ?? null }));
      return { donoTransferido: false };
    }
    case "iniciar_agente_ia": {
      if (!acao.agenteId) return { donoTransferido: false }; // validarGrafo barra publicar sem agente, defesa extra
      const agente = await buscarAgente(clinicaId, acao.agenteId);
      if (!agente) {
        console.error("[fluxo-execucoes] acao_crm_falhou", JSON.stringify({ acao: acao.tipo, conversaId, error: "agente_nao_encontrado" }));
        return { donoTransferido: false };
      }
      const resultado = await assumirControle(clinicaId, conversaId, "agente_ia", {
        agente_ativo_id: agente.id,
        agente_pausado_ate: null,
        ultimo_agente_id: agente.id,
      });
      if (!resultado.ok) {
        console.error("[fluxo-execucoes] acao_crm_falhou", JSON.stringify({ acao: acao.tipo, conversaId, error: resultado.error ?? null }));
        return { donoTransferido: false };
      }
      return { donoTransferido: true };
    }

    // Fase 3 — cria a pesquisa/solicitação ANTES de qualquer resposta (ciclo
    // de vida real: enviada → respondida/expirada, ver migration v22). Nasce
    // 'enviada' porque este motor não confirma entrega separada do envio
    // (nenhuma mensagem de nenhum outro nó confirma — mesmo critério de
    // `enviarComRetry`, "melhor esforço"); 'pendente' fica reservado pra uma
    // origem futura que precise desse estado intermediário de verdade.
    case "criar_pesquisa": {
      if (!contexto.pacienteId) {
        console.error("[fluxo-execucoes] acao_crm_falhou", JSON.stringify({ acao: acao.tipo, conversaId, error: "sem_paciente" }));
        return { donoTransferido: false };
      }

      // Fase 5 (Reputação/Google Reviews) — só este tipo carrega link: o
      // valor salvo em `variavelDestino` vira o texto que o nó "mensagem"
      // vai mandar, então precisa ser uma URL, não o `pesquisa_id` cru (que
      // é o que nps/satisfacao continuam recebendo, pra `capturar_resposta`
      // casar a resposta com a pesquisa certa). Recusa criar se o módulo
      // não estiver configurado — nunca manda pesquisa sem link nenhum.
      let trackingToken: string | null = null;
      let trackingExpiraEm: string | null = null;
      let linkParaVariavel: string | null = null;
      if (acao.tipoPesquisa === "avaliacao_google") {
        const config = await buscarConfigReputacao(clinicaId);
        if (!config.ativo || !config.googleReviewUrl) {
          console.error("[fluxo-execucoes] acao_crm_falhou", JSON.stringify({ acao: acao.tipo, conversaId, error: "reputacao_nao_configurada" }));
          return { donoTransferido: false };
        }
        if (config.rastrearCliques) {
          trackingToken = gerarTrackingToken();
          trackingExpiraEm = calcularExpiracaoToken();
          // APP_URL ausente: cai pro link direto do Google — nunca deixa a
          // mensagem sair sem link só porque o tracking não pôde montar a URL.
          linkParaVariavel = montarUrlRastreavel(trackingToken) ?? config.googleReviewUrl;
        } else {
          linkParaVariavel = config.googleReviewUrl;
        }
      }

      const agora = new Date().toISOString();
      const { data, error } = await supabase
        .from("pesquisas")
        .insert({
          clinica_id: clinicaId,
          paciente_id: contexto.pacienteId,
          fluxo_id: contexto.fluxoId,
          execucao_id: contexto.execucaoId,
          tipo: acao.tipoPesquisa,
          status: "enviada",
          referencia_id: acao.referenciaId,
          enviado_em: agora,
          tracking_token: trackingToken,
          tracking_token_expira_em: trackingExpiraEm,
        })
        .select("id")
        .single();
      if (error || !data) {
        console.error("[fluxo-execucoes] acao_crm_falhou", JSON.stringify({ acao: acao.tipo, conversaId, code: error?.code ?? null }));
        return { donoTransferido: false };
      }
      const valorVariavel = acao.tipoPesquisa === "avaliacao_google" ? (linkParaVariavel as string) : (data.id as string);
      return { donoTransferido: false, variaveisExtra: { [acao.variavelDestino]: valorVariavel } };
    }

    // Fase 3 — único responsável por gravar `pesquisa_respostas`: nunca o
    // mesmo nó que cria (ver fluxo-tipos.ts). Google Reviews (`avaliacao_google`)
    // nunca chega aqui de propósito — não há como provar publicação de
    // avaliação sem integração real, então esta ação recusa gravar resposta
    // pra esse tipo mesmo que um fluxo mal configurado tente.
    case "persistir_resposta_pesquisa": {
      const pesquisaId = contexto.variaveis[acao.variavelPesquisaId];
      if (!pesquisaId) {
        console.error("[fluxo-execucoes] acao_crm_falhou", JSON.stringify({ acao: acao.tipo, conversaId, error: "pesquisa_id_ausente" }));
        return { donoTransferido: false };
      }
      const { data: pesquisa } = await supabase.from("pesquisas").select("tipo, clinica_id").eq("id", pesquisaId).maybeSingle();
      if (!pesquisa || pesquisa.clinica_id !== clinicaId) {
        console.error("[fluxo-execucoes] acao_crm_falhou", JSON.stringify({ acao: acao.tipo, conversaId, error: "pesquisa_nao_encontrada" }));
        return { donoTransferido: false };
      }
      if (pesquisa.tipo === "avaliacao_google") {
        console.error("[fluxo-execucoes] acao_crm_falhou", JSON.stringify({ acao: acao.tipo, conversaId, error: "google_nao_aceita_resposta" }));
        return { donoTransferido: false };
      }

      const valorBruto = contexto.variaveis[acao.variavelValor] ?? "";
      const comentario = acao.variavelComentario ? (contexto.variaveis[acao.variavelComentario] ?? null) : null;
      const numero = Number(valorBruto);
      const ehNumero = valorBruto.trim() !== "" && Number.isFinite(numero);
      // Fase 4 — só 'nps' usa a escala 0-10 detrator/neutro/promotor;
      // 'satisfacao' compartilha a mesma tabela sem essa classificação.
      const classificacao = pesquisa.tipo === "nps" && ehNumero ? classificarNps(numero) : null;

      const { error: erroResposta } = await supabase.from("pesquisa_respostas").insert({
        pesquisa_id: pesquisaId,
        valor_numero: ehNumero ? numero : null,
        valor_texto: ehNumero ? null : valorBruto,
        comentario,
        classificacao,
      });
      if (erroResposta) {
        console.error("[fluxo-execucoes] acao_crm_falhou", JSON.stringify({ acao: acao.tipo, conversaId, code: erroResposta.code ?? null }));
        return { donoTransferido: false };
      }
      // updated_at: mesmo padrão do resto do projeto (conversas.ts:atualizarStatus
      // etc.) — sem trigger de banco, todo UPDATE seta o campo explicitamente.
      const agoraResposta = new Date().toISOString();
      await supabase.from("pesquisas").update({ status: "respondida", respondido_em: agoraResposta, updated_at: agoraResposta }).eq("id", pesquisaId);
      return { donoTransferido: false };
    }
  }
}

type ContextoExecucao = {
  execucaoId: string;
  clinicaId: string;
  fluxoId: string;
  versaoId: string;
  conversaId: string | null;
  oportunidadeId: string | null;
  comercial: ContextoComercial | null;
  criadoEm: string;
  marcoRespostaEm: string;
  pacienteId: string | null;
  noAtualId: string | null;
  variaveis: Record<string, string>;
  passosExecutados: number;
  isTest: boolean;
  definicao: FluxoDefinicao;
  paciente: ContextoPaciente;
};

async function carregarContextoExecucao(supabase: SupabaseClient, clinicaId: string, execucaoId: string): Promise<ContextoExecucao | null> {
  const { data: execucao, error: erroExecucao } = await supabase
    .from("fluxo_execucoes")
    // Hint explícito (`conversas!conversa_id`) obrigatório: `conversas` também
    // referencia `fluxo_execucoes` de volta (`fluxo_execucao_ativa_id`), então
    // sem o hint o PostgREST recusa o embed por ambiguidade de relação — achado
    // só na validação manual (a query falhava em silêncio, `error` nunca era
    // checado aqui, só `data`).
    .select(
      "id, fluxo_id, versao_id, conversa_id, paciente_id, no_atual_id, variaveis, passos_executados, is_test, oportunidade_id, contexto_comercial, created_at, marco_resposta_em, conversas!conversa_id(telefone)"
    )
    .eq("id", execucaoId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (erroExecucao || !execucao) {
    console.error(
      "[fluxo-execucoes] carregar_execucao_failed",
      JSON.stringify({ execucaoId, code: erroExecucao?.code ?? null, message: erroExecucao?.message?.slice(0, 200) ?? null })
    );
    return null;
  }

  const { data: versao, error: erroVersao } = await supabase
    .from("fluxo_versoes")
    .select("definicao")
    .eq("id", execucao.versao_id as string)
    .eq("clinica_id", clinicaId)
    .eq("fluxo_id", execucao.fluxo_id as string)
    .maybeSingle();
  if (erroVersao || !versao) {
    console.error(
      "[fluxo-execucoes] carregar_versao_failed",
      JSON.stringify({ execucaoId, versaoId: execucao.versao_id, code: erroVersao?.code ?? null })
    );
    return null;
  }

  const formaValidada = validarFormaDefinicao(versao.definicao);
  if (!formaValidada.ok) {
    console.error("[fluxo-execucoes] definicao_invalida", JSON.stringify({ execucaoId, erro: formaValidada.erro }));
    return null;
  }

  let nomePaciente: string | null = null;
  const pacienteId = (execucao.paciente_id as string | null) ?? null;
  if (pacienteId) {
    const { data: paciente } = await supabase.from("pacientes").select("nome").eq("id", pacienteId).eq("clinica_id", clinicaId).maybeSingle();
    nomePaciente = (paciente?.nome as string | null) ?? null;
  }

  const conversaEmbutida = execucao.conversas as { telefone: string } | { telefone: string }[] | null;
  const telefone = (Array.isArray(conversaEmbutida) ? conversaEmbutida[0]?.telefone : conversaEmbutida?.telefone) ?? "";

  // Cacheado em processo (buscarClinicaAtual) — custo real só na 1ª chamada.
  const { data: clinicaAtual } = await supabase.from("clinicas").select("nome").eq("id", clinicaId).maybeSingle();

  return {
    execucaoId: execucao.id as string,
    clinicaId,
    fluxoId: execucao.fluxo_id as string,
    versaoId: execucao.versao_id as string,
    conversaId: (execucao.conversa_id as string | null) ?? null,
    oportunidadeId: (execucao.oportunidade_id as string | null) ?? null,
    comercial: (execucao.contexto_comercial as ContextoComercial | null) ?? null,
    criadoEm: execucao.created_at as string,
    marcoRespostaEm: (execucao.marco_resposta_em as string | null) ?? execucao.created_at as string,
    pacienteId,
    noAtualId: (execucao.no_atual_id as string | null) ?? null,
    variaveis: (execucao.variaveis as Record<string, string> | null) ?? {},
    passosExecutados: execucao.passos_executados as number,
    isTest: Boolean(execucao.is_test),
    definicao: formaValidada.definicao,
    paciente: { nome: nomePaciente, telefone, clinicaNome: clinicaAtual?.nome ?? null },
  };
}

/** Visitas reais (exclui `menu_invalido`) e tentativas inválidas desde a última entrada real no nó. */
async function contarNo(supabase: SupabaseClient, execucaoId: string, noId: string): Promise<ContadoresNo> {
  const { data: eventos } = await supabase
    .from("fluxo_execucao_eventos")
    .select("tipo_evento")
    .eq("execucao_id", execucaoId)
    .eq("no_id", noId)
    .eq("status", "concluido")
    .order("sequencia", { ascending: true });

  let visitas = 0;
  let tentativasInvalidas = 0;
  for (const evento of eventos ?? []) {
    if (evento.tipo_evento === "menu_invalido") tentativasInvalidas++;
    else {
      visitas++;
      tentativasInvalidas = 0; // nova entrada real no nó zera a contagem de tentativas
    }
  }
  return { visitas, tentativasInvalidas };
}


type Claim = { execucaoId: string; token: string; entrada: EntradaProcessamento };

async function processarPassoReivindicado(clinicaId: string, execucaoId: string, entrada: EntradaProcessamento, token: string): Promise<void> {
  const db = getSupabaseServerClient();
  if (!db) return;
  let contexto: ContextoExecucao | null = null;
  let sequencia: number | null = null;
  const autorizar = async (contato: boolean) => {
    const r = await db.rpc("fluxo_autorizar_passo", { p_clinica: clinicaId, p_execucao: execucaoId, p_token: token, p_contato: contato, p_resposta: entrada.tipo === "resposta_texto" });
    if (r.error) throw new Error("guarda_indisponivel");
    return r.data as { ok: boolean; error?: string };
  };
  const concluir = async (patch: Record<string, unknown>) => {
    const r = await db.rpc("fluxo_concluir_passo", { p_clinica: clinicaId, p_execucao: execucaoId, p_token: token, p_patch: patch, p_resposta: entrada.tipo === "resposta_texto" });
    if (r.error) throw new Error("confirmacao_passo_falhou");
    return r.data === true;
  };
  const adiar = async (ate: string, motivo: string) => {
    if (!contexto) return;
    await db.from("fluxo_execucao_eventos").insert({ execucao_id: execucaoId, clinica_id: clinicaId, sequencia: contexto.passosExecutados,
      tipo_evento: motivo, status: "concluido", is_test: contexto.isTest });
    await concluir({ estado: "waiting_time", no_atual_id: contexto.noAtualId, aguardando_ate: ate });
    console.log("[fluxo] adiado", JSON.stringify({ execucaoId, motivo, ate }));
  };
  try {
    contexto = await carregarContextoExecucao(db, clinicaId, execucaoId);
    if (!contexto?.noAtualId) throw new Error("contexto_invalido");
    sequencia = contexto.passosExecutados;
    if (!(await autorizar(false)).ok) return;
    if (contexto.oportunidadeId) contexto.variaveis = { ...contexto.variaveis, ...await carregarVariaveisComerciais(db, clinicaId, contexto.oportunidadeId, contexto.conversaId, contexto.marcoRespostaEm, execucaoId) };
    const contadores = await contarNo(db, execucaoId, contexto.noAtualId);
    const resultado = processarNo(contexto.definicao, contexto.noAtualId, contexto.variaveis, entrada, contexto.paciente, contadores);
    if (!resultado.ok) throw new Error(resultado.erro);
    const temContato = resultado.mensagensParaEnviar.length > 0;
    if (contexto.isTest && (temContato || resultado.acaoCrm?.tipo === "criar_alerta_interno") && process.env.FLUXOS_TESTE_ENVIO_REAL !== "true") throw new Error("teste_envio_nao_autorizado");
    if (contexto.comercial && temContato) {
      if (contexto.comercial.config.respeitarHorario) {
        const horario = await buscarConfiguracaoHorario(clinicaId);
        if (!horario) throw new Error("horario_indisponivel");
        if (!avaliarHorarioAtendimento(horario, new Date()).dentro) {
          const proximo = calcularProximoHorario(horario, new Date());
          if (!proximo) throw new Error("horario_sem_abertura");
          await adiar(proximo.toISOString(), "aguardando_horario"); return;
        }
      }
      if (!contexto.conversaId && contexto.pacienteId) {
        const conversa = await obterOuCriarConversaDoPaciente(clinicaId, contexto.pacienteId);
        if (!conversa) throw new Error("canal_nao_encontrado");
        const vinculo = await db.from("fluxo_execucoes").update({ conversa_id: conversa }).eq("id", execucaoId).eq("clinica_id", clinicaId).eq("claim_token", token).eq("estado", "running").select("id").maybeSingle();
        if (vinculo.error || !vinculo.data) throw new Error("claim_perdido");
        contexto.conversaId = conversa;
        const c = await db.from("conversas").select("telefone").eq("id", conversa).eq("clinica_id", clinicaId).maybeSingle();
        contexto.paciente.telefone = c.data?.telefone ?? "";
      }
    }
    if (temContato) {
      const guarda = await autorizar(true);
      if (!guarda.ok) {
        if (guarda.error === "conversa_ocupada") {
          if (Date.now() - Date.parse(contexto.criadoEm) > 7 * 86400000) throw new Error("conversa_ocupada");
          await adiar(new Date(Date.now() + 60000).toISOString(), "aguardando_conversa");
        }
        return;
      }
    }
    const registro = await db.from("fluxo_execucao_eventos").insert({ execucao_id: execucaoId, clinica_id: clinicaId, sequencia,
      no_id: contexto.noAtualId, tipo_evento: "processando", status: "em_andamento", is_test: contexto.isTest });
    if (registro.error) {
      // Evento existente NUNCA ? licen?a pra reaplicar efeito externo.
      if (registro.error.code === "23505") return;
      throw new Error("registro_passo_falhou");
    }
    let variaveisExtra: Record<string, string> = {};
    if (resultado.acaoCrm) {
      if (!(await autorizar(false)).ok) return;
      if (resultado.acaoCrm.tipo === "acao_comercial") {
        if (!contexto.oportunidadeId) throw new Error("acao_exige_oportunidade");
        if (resultado.acaoCrm.acao === "alerta") {
          const alerta = await abrirAlertaPorEvento(clinicaId, { tipo: "acompanhamento_comercial", chave: "comercial:" + execucaoId + ":" + sequencia,
            severidade: "atencao", titulo: "Oportunidade precisa de acompanhamento", descricao: resultado.acaoCrm.valor,
            tipoEntidade: "oportunidade", entidadeId: contexto.oportunidadeId, responsavelId: contexto.variaveis.responsavel_id || null, dados: { execucaoId } });
          if (alerta.resultado === "erro") throw new Error("alerta_falhou");
        } else {
          const acao = await db.rpc("fluxo_aplicar_acao_comercial", { p_clinica: clinicaId, p_execucao: execucaoId, p_token: token, p_acao: resultado.acaoCrm });
          if (acao.error || !acao.data?.ok) throw new Error(acao.data?.error ?? "acao_comercial_falhou");
        }
      } else {
        if (!contexto.conversaId) throw new Error("acao_exige_conversa");
        const efeito = await aplicarAcaoCrm(db, clinicaId, contexto.conversaId, { pacienteId: contexto.pacienteId, fluxoId: contexto.fluxoId, execucaoId, variaveis: contexto.variaveis }, resultado.acaoCrm);
        variaveisExtra = efeito.variaveisExtra ?? {};
      }
    }
    const canal = temContato && contexto.conversaId ? await buscarCanalDaConversa(clinicaId, contexto.conversaId) : null;
    for (const texto of resultado.mensagensParaEnviar) {
      if (!canal || !contexto.conversaId || !contexto.paciente.telefone) throw new Error("canal_nao_encontrado");
      for (let tentativa = 1; tentativa <= 3; tentativa++) {
        if (!(await autorizar(true)).ok) return;
        const intencao = await db.from("fluxo_execucao_eventos").update({ tentativa, payload: { envio: "autorizado", canalId: canal.id }, updated_at: new Date().toISOString() }).eq("execucao_id", execucaoId).eq("clinica_id", clinicaId).eq("sequencia", sequencia);
        if (intencao.error) throw new Error("intencao_envio_falhou");
        const envio = await enviarPeloCanal(canal, contexto.paciente.telefone, texto);
        if (!envio.ok) {
          // 429 recusou o pedido. Timeout/5xx podem ter ocorrido AP?S aceita??o: n?o repetir.
          if (envio.error === "http_429" && tentativa < 3) { await new Promise(r => setTimeout(r, tentativa * 500)); continue; }
          const incerto = envio.error === "request_error" || /^http_5/.test(envio.error ?? "");
          throw new Error(incerto ? "envio_incerto" : envio.error ?? "envio_falhou");
        }
        const agora = new Date().toISOString();
        const mensagem = await db.from("mensagens").insert({ clinica_id: clinicaId, conversa_id: contexto.conversaId,
          direcao: "enviada", tipo: "texto", conteudo: texto, evolution_message_id: envio.mensagemId ?? null, timestamp_whatsapp: agora });
        if (mensagem.error && mensagem.error.code !== "23505") throw new Error("envio_incerto");
        await db.from("conversas").update({ ultima_mensagem_em: agora, updated_at: agora }).eq("id", contexto.conversaId).eq("clinica_id", clinicaId);
        const confirmado = await db.from("fluxo_execucao_eventos").update({ payload: { envio: "confirmado", mensagemId: envio.mensagemId, canalId: canal.id } }).eq("execucao_id", execucaoId).eq("sequencia", sequencia).eq("clinica_id", clinicaId);
        if (confirmado.error) throw new Error("envio_incerto");
        break;
      }
    }
    const terminou = await concluir({ estado: resultado.novoEstado, no_atual_id: resultado.proximoNoId, aguardando_ate: resultado.aguardandoAte,
      variaveis: { ...contexto.variaveis, ...resultado.variaveisAtualizadas, ...variaveisExtra }, motivo_finalizacao: resultado.motivoFinalizacao ?? null });
    const registroFinal = await db.from("fluxo_execucao_eventos").update({ status: "concluido", tipo_evento: resultado.tipoEvento,
      ...(resultado.payloadEvento ? { payload: resultado.payloadEvento } : {}), updated_at: new Date().toISOString() }).eq("execucao_id", execucaoId).eq("clinica_id", clinicaId).eq("sequencia", sequencia);
    if (registroFinal.error) throw new Error("confirmacao_evento_falhou");
    console.log("[fluxo] passo", JSON.stringify({ execucaoId, sequencia, tipo: resultado.tipoEvento, estado: resultado.novoEstado, atualizado: terminou }));
  } catch (e) {
    const erro = e instanceof Error ? e.message : "passo_falhou";
    await concluir({ estado: "failed", no_atual_id: contexto?.noAtualId ?? null, erro, motivo_finalizacao: erro }).catch(() => undefined);
    if (sequencia !== null) await db.from("fluxo_execucao_eventos").update({ status: "falhou", erro, updated_at: new Date().toISOString() }).eq("execucao_id", execucaoId).eq("clinica_id", clinicaId).eq("sequencia", sequencia);
    console.error("[fluxo] falhou", JSON.stringify({ execucaoId, sequencia, erro }));
    if (contexto && !isErroDeCanal(erro) && erro !== "claim_perdido" && erro !== "teste_envio_nao_autorizado") await abrirAlertaPorEvento(clinicaId, {
      tipo: "fluxo_falhou", chave: "fluxo_falhou:" + execucaoId, severidade: "atencao", titulo: "Acompanhamento autom?tico interrompido",
      descricao: erro === "envio_incerto" ? "Confira a última mensagem na conversa antes de retomar. A entrega não pôde ser confirmada." : "Não foi possível concluir uma automação. Confira o atendimento e peça apoio à equipe responsável.",
      tipoEntidade: "fluxo_execucao", entidadeId: execucaoId, responsavelId: null, dados: { execucaoId } });
  }
}

export async function reivindicarProximaExecucaoDue(clinicaId: string): Promise<Claim | null> {
  const db = getSupabaseServerClient();
  if (!db) return null;
  const { data, error } = await db.rpc("fluxo_reivindicar", { p_clinica: clinicaId, p_comerciais: automacoesComerciaisHabilitadas() });
  if (error) throw new Error("claim_indisponivel");
  return data ? { execucaoId: data.id, token: data.token, entrada: { tipo: data.entrada } } : null;
}
export async function resolverRespostaWaitingInput(clinicaId: string, execucaoId: string, texto: string): Promise<boolean> {
  const db = getSupabaseServerClient();
  if (!db) return false;
  const { data, error } = await db.rpc("fluxo_reivindicar", { p_clinica: clinicaId, p_execucao: execucaoId, p_resposta: true });
  if (error || !data) return false;
  await processarPassoReivindicado(clinicaId, execucaoId, { tipo: "resposta_texto", texto }, data.token);
  return true;
}

export type GatilhoExecucao = { tipo: string; refId?: string | null; dedupeKey?: string | null };

/**
 * Ponto único de entrada pra começar uma execução — webhook, campanha, cron
 * de inatividade ou início manual (só o webhook chama nesta fase). Recusa se
 * `dono_conversa='humano'`; só assume sobre `'agente_ia'` se
 * `fluxos.pode_interromper_agente_ia`. `23505` do índice único de "execução
 * ativa por conversa" ou do dedupe de gatilho é sucesso silencioso (mesmo
 * padrão de `campanha_eventos`/`mensagens`), nunca erro.
 *
 * `conversaEraNova`: a coluna `dono_conversa` NASCE `'humano'` (default da
 * migration v20) — uma conversa recém-criada tem esse valor não porque um
 * humano esteja de fato engajado nela, mas porque ninguém assumiu ainda. A
 * regra "recusa se humano" existe pra proteger um atendimento humano JÁ EM
 * ANDAMENTO (visão: "se há conversa humana ativa, não iniciar fluxo
 * automaticamente") — uma conversa que não existia um instante atrás não
 * pode ter esse tipo de engajamento. Sem esta exceção, os gatilhos
 * `nova_conversa`/`primeira_mensagem` nunca disparariam nunca.
 */
export async function iniciarExecucaoFluxo(
  clinicaId: string,
  fluxoId: string,
  conversaId: string,
  pacienteId: string | null,
  gatilho: GatilhoExecucao,
  podeInterromperAgenteIa: boolean,
  isTest = false,
  conversaEraNova = false,
  // Só tem efeito quando isTest===true (ver checagem abaixo) — permite ao
  // editor visual (Fase 2b/3) testar o RASCUNHO (fluxo_versoes.status=
  // 'rascunho'), não só a versão publicada. Uma execução real nunca pode
  // rodar uma versão não publicada: estruturalmente impossível, porque o
  // parâmetro é ignorado sempre que isTest é false.
  versaoIdForcada: string | null = null
): Promise<{ ok: boolean; execucaoId?: string; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data: conversa } = await supabase
    .from("conversas")
    .select("dono_conversa")
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (!conversa) return { ok: false, error: "conversa_invalida" };
  const donoAtual = (conversa?.dono_conversa as string | null) ?? "humano";
  // `&& !isTest`: sem isso, o contato de teste do editor fica bloqueado a
  // partir do 2º teste — toda execução termina devolvendo dono_conversa pra
  // 'humano' (correto em produção), e essa conversa não é "nova", então o
  // teste seguinte seria sempre recusado por essa guarda. A guarda em si
  // (impedir iniciar fluxo sobre atendimento humano genuinamente ativo)
  // continua valendo à risca pra execução real (isTest=false).
  if (donoAtual === "humano" && !conversaEraNova && !isTest) return { ok: false, error: "conversa_com_humano" };
  if (donoAtual === "agente_ia" && !podeInterromperAgenteIa) return { ok: false, error: "agente_ia_ativo" };

  const { data: versao } = await (isTest && versaoIdForcada
    ? supabase.from("fluxo_versoes").select("id, definicao").eq("id", versaoIdForcada).eq("fluxo_id", fluxoId).eq("clinica_id", clinicaId).maybeSingle()
    : supabase.from("fluxo_versoes").select("id, definicao").eq("fluxo_id", fluxoId).eq("status", "publicada").eq("clinica_id", clinicaId).maybeSingle());
  if (!versao) return { ok: false, error: "sem_versao_publicada" };

  const forma = validarFormaDefinicao(versao.definicao);
  if (!forma.ok) return { ok: false, error: "definicao_invalida" };
  const inicio = encontrarNoInicio(forma.definicao);
  if (!inicio) return { ok: false, error: "sem_no_inicio" };

  const agora = new Date().toISOString();
  const { data: execucao, error } = await supabase
    .from("fluxo_execucoes")
    .insert({
      clinica_id: clinicaId,
      fluxo_id: fluxoId,
      versao_id: versao.id as string,
      conversa_id: conversaId,
      paciente_id: pacienteId,
      estado: "queued",
      no_atual_id: inicio.id,
      aguardando_ate: agora,
      passos_executados: 0,
      gatilho_tipo: gatilho.tipo,
      gatilho_ref_id: gatilho.refId ?? null,
      gatilho_dedupe_key: gatilho.dedupeKey ?? null,
      is_test: isTest,
    })
    .select("id")
    .single();

  if (error || !execucao) {
    // 23505: já existe execução ativa pra esta conversa OU já existe execução
    // deste fluxo pra este gatilho (dedupe) — sucesso silencioso, não erro.
    if (error?.code === "23505") return { ok: true, error: "ja_existe" };
    console.error("[fluxo-execucoes] iniciar_failed", JSON.stringify({ fluxoId, conversaId, code: error?.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  const execucaoId = execucao.id as string;
  await assumirControle(clinicaId, conversaId, "fluxo", { fluxo_execucao_ativa_id: execucaoId });

  // Processa o nó "início" sincronamente — não espera o poller pro 1º passo.
  const claim = await supabase.rpc("fluxo_reivindicar", { p_clinica: clinicaId, p_execucao: execucaoId });
  if (claim.data && !claim.error) await processarPassoReivindicado(clinicaId, execucaoId, { tipo: "avancar" }, claim.data.token);

  return { ok: true, execucaoId };
}

/**
 * Chamada pelo webhook a cada mensagem recebida, antes do bloco do Agente de
 * IA: procura um fluxo `ativo` cujo gatilho bata com o evento (só
 * `nova_conversa`/`primeira_mensagem`/`palavra_chave` nesta fase — os
 * demais gatilhos da visão entram por Campanhas/Disparos/cron, não aqui) e
 * inicia a execução se achar. `false` = nenhum fluxo casou (ou a arbitragem
 * recusou) — o chamador segue pro caminho normal (Agente de IA).
 */
export async function tentarIniciarFluxoPorMensagem(
  clinicaId: string,
  conversaId: string,
  pacienteId: string | null,
  conversaEraNova: boolean,
  textoMensagem: string
): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return false;

  const { data: fluxosAtivos } = await supabase
    .from("fluxos")
    .select("id, gatilho_tipo, gatilho_config, pode_interromper_agente_ia")
    .eq("clinica_id", clinicaId)
    .eq("status", "ativo")
    .not("gatilho_tipo", "is", null);

  const candidato = (fluxosAtivos ?? []).find((f) =>
    combinaGatilhoMensagem(f.gatilho_tipo as string, (f.gatilho_config as Record<string, unknown>) ?? {}, {
      conversaEhNova: conversaEraNova,
      textoMensagem,
    })
  );
  if (!candidato) return false;

  const gatilhoTipo = candidato.gatilho_tipo as string;
  const resultado = await iniciarExecucaoFluxo(
    clinicaId,
    candidato.id as string,
    conversaId,
    pacienteId,
    { tipo: gatilhoTipo, refId: null, dedupeKey: dedupeKeyParaGatilho(gatilhoTipo, conversaId) },
    Boolean(candidato.pode_interromper_agente_ia),
    false,
    conversaEraNova
  );
  return resultado.ok;
}

/** Chamada pelo worker (fluxo-worker.ts) depois de `reivindicarProximaExecucaoDue`. */
export async function processarProximoPassoDevido(clinicaId: string): Promise<boolean> {
  const reivindicada = await reivindicarProximaExecucaoDue(clinicaId);
  if (!reivindicada) return false;
  await processarPassoReivindicado(clinicaId, reivindicada.execucaoId, reivindicada.entrada, reivindicada.token);
  return true;
}

const JANELA_GRACA_RECOVERY_MS = 2 * 60_000;

/**
 * Varredura de recovery no boot do worker (`fluxo-worker.ts`, antes do 1º
 * `setTimeout`) — pega passos que ficaram presos por um crash no meio do
 * processamento. Duas fontes, não uma só (ver nota de topo do arquivo sobre
 * não usar CTE/RPC): (1) eventos `em_andamento` — o caso normal, o `INSERT`
 * do evento aconteceu mas o passo não terminou; (2) `fluxo_execucoes` com
 * `estado='running'` direto — defesa extra pro caso raro em que o processo
 * morreu ENTRE a `UPDATE` de claim e o `INSERT` do evento (sem isso, essa
 * execução ficaria travada pra sempre: o due-scan exclui `running` de
 * propósito, e a fonte 1 não acharia nada porque nenhum evento chegou a
 * existir).
 */
export async function recuperarExecucoesTravadas(): Promise<{ recuperadas: number }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { recuperadas: 0 };

  const clinicaId = await getClinicaId();
  if (!clinicaId) return { recuperadas: 0 };
  const corte = new Date(Date.now() - JANELA_GRACA_RECOVERY_MS).toISOString();
  let recuperadas = 0;

  const { data: eventosPresos } = await supabase
    .from("fluxo_execucao_eventos")
    .select("id, execucao_id")
    .eq("status", "em_andamento")
    .eq("clinica_id", clinicaId)
    .lt("updated_at", corte);

  for (const evento of eventosPresos ?? []) {
    await supabase
      .from("fluxo_execucao_eventos")
      .update({ status: "falhou", erro: "recovery_apos_restart", updated_at: new Date().toISOString() })
      .eq("id", evento.id as string);
    recuperadas += await falharExecucaoPresa(supabase, evento.execucao_id as string);
  }

  const { data: execucoesPresas } = await supabase
    .from("fluxo_execucoes")
    .select("id")
    .eq("estado", "running")
    .eq("clinica_id", clinicaId)
    .lt("claim_ate", new Date().toISOString());

  for (const execucao of execucoesPresas ?? []) {
    recuperadas += await falharExecucaoPresa(supabase, execucao.id as string);
  }

  if (recuperadas > 0) console.log("[fluxo-execucoes] recovery_apos_restart", JSON.stringify({ recuperadas }));
  return { recuperadas };
}

async function falharExecucaoPresa(supabase: SupabaseClient, execucaoId: string): Promise<number> {
  const { data: execucao } = await supabase
    .from("fluxo_execucoes")
    .select("id")
    .eq("id", execucaoId)
    .eq("estado", "running")
    .maybeSingle();
  if (!execucao) return 0; // já recuperada por outra via, ou terminou normalmente entretanto

  await supabase
    .from("fluxo_execucoes")
    .update({ estado: "failed", erro: "recovery_apos_restart", finalizado_em: new Date().toISOString(), claim_token: null, claim_ate: null })
    .eq("id", execucaoId);
  return 1;
}

/**
 * Transfere pra humano a execução ativa de uma conversa, se houver — chamada
 * quando um atendente responde manualmente pelo Chat ao Vivo
 * (`src/lib/chat.ts:enviarRespostaChat`) enquanto `dono_conversa==='fluxo'`.
 * Sem isso, uma `espera` de dias continuaria mandando mensagem automática por
 * cima do atendimento humano — a execução em si precisa parar, não só o
 * roteador de quem responde (`dono_conversa`). Silenciosa de propósito
 * (nunca bloqueia o envio manual em si).
 */
export async function transferirExecucaoAtivaParaHumano(clinicaId: string, conversaId: string, motivo: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { data: conversa } = await supabase
    .from("conversas")
    .select("fluxo_execucao_ativa_id")
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();

  const execucaoId = (conversa?.fluxo_execucao_ativa_id as string | null) ?? null;
  if (!execucaoId) return;

  const agoraTransferencia = new Date().toISOString();
  const { error } = await supabase
    .from("fluxo_execucoes")
    .update({ estado: "transferred", motivo_finalizacao: motivo, finalizado_em: agoraTransferencia, updated_at: agoraTransferencia })
    .eq("id", execucaoId)
    .eq("clinica_id", clinicaId)
    .in("estado", ["queued", "running", "waiting_input", "waiting_time"]);

  if (error) {
    console.error("[fluxo-execucoes] transferir_failed", JSON.stringify({ conversaId, execucaoId, code: error.code ?? null }));
  }

  await liberarControle(clinicaId, conversaId, { fluxo_execucao_ativa_id: null });
}

/**
 * Cancela qualquer execução ativa do paciente que deu opt-out — chamada pelo
 * webhook (`src/app/api/webhook/evolution/route.ts`) logo depois de
 * `aplicarOptOut` (`src/lib/opt-out.ts`), nunca de dentro de `opt-out.ts`
 * (evitaria um import circular: `fluxo-execucoes.ts` já importa
 * `detectarPedidoOptOut` de lá). A visão pede as duas garantias: nunca mandar
 * mensagem nova (já coberto em `processarPassoReivindicado`) E cancelar
 * execuções pendentes — sem isso, opt-out no meio de uma `espera` longa ou de
 * um `waiting_input` sem timeout deixaria uma execução zumbi ocupando o slot
 * único de "execução ativa por conversa" pra sempre.
 */
export async function cancelarExecucoesAtivasDoPaciente(clinicaId: string, pacienteId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { data: ativas } = await supabase
    .from("fluxo_execucoes")
    .select("id, conversa_id")
    .eq("clinica_id", clinicaId)
    .eq("paciente_id", pacienteId)
    .in("estado", ["queued", "running", "waiting_input", "waiting_time"]);

  for (const execucao of ativas ?? []) {
    await supabase
      .from("fluxo_execucoes")
      .update({ estado: "cancelled", motivo_finalizacao: "opt_out", finalizado_em: new Date().toISOString() })
      .eq("id", execucao.id as string);
    await liberarControle(clinicaId, execucao.conversa_id as string, { fluxo_execucao_ativa_id: null });
  }
}
