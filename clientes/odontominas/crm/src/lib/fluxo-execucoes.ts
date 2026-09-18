import { getSupabaseServerClient } from "@/lib/supabase";
import { assumirControle, liberarControle } from "@/lib/dono-conversa";
import { enviarPeloCanal, enviarPeloCanalPrincipal } from "@/lib/canais-envio";
import { buscarCanalDaConversa, type Canal } from "@/lib/canais";
import { atribuirPorAutomacao } from "@/lib/atribuicao";
import { detectarPedidoOptOut } from "@/lib/opt-out";
import { encontrarNoInicio, validarFormaDefinicao, type FluxoDefinicao } from "@/lib/fluxo-tipos";
import { processarNo, type AcaoCrm, type ContadoresNo, type ContextoPaciente, type EntradaProcessamento, type EstadoExecucao } from "@/lib/fluxo-motor";
import { combinaGatilhoMensagem, dedupeKeyParaGatilho } from "@/lib/fluxo-gatilhos";
import { adicionarEtiquetaConversa, removerEtiquetaConversa } from "@/lib/etiquetas";
import { atualizarStatus } from "@/lib/conversas";
import { isPrioridadeValida } from "@/lib/prioridade";
import { buscarAgente } from "@/lib/agentes";
import { buscarClinicaAtual } from "@/lib/clinica";
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

const TENTATIVAS_ENVIO = 3;
const CODIGOS_RETRY_ENVIO = new Set(["http_429", "http_500", "http_502", "http_503", "http_504", "request_error"]);

/** Manda uma mensagem com retry curto em falha transiente da Evolution (429/5xx/timeout) — nunca em 4xx de auth. */
async function enviarComRetry(canal: Canal, telefone: string, texto: string): Promise<{ ok: boolean; error?: string; mensagemId?: string | null }> {
  let ultimoErro: string | undefined;
  for (let tentativa = 1; tentativa <= TENTATIVAS_ENVIO; tentativa++) {
    const resultado = await enviarPeloCanal(canal, telefone, texto);
    if (resultado.ok) return resultado;
    ultimoErro = resultado.error;
    if (!resultado.error || !CODIGOS_RETRY_ENVIO.has(resultado.error) || tentativa === TENTATIVAS_ENVIO) break;
    await new Promise((resolve) => setTimeout(resolve, 500 * tentativa));
  }
  return { ok: false, error: ultimoErro };
}

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
  conversaId: string;
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
      "id, fluxo_id, versao_id, conversa_id, paciente_id, no_atual_id, variaveis, passos_executados, is_test, conversas!conversa_id(telefone)"
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
    const { data: paciente } = await supabase.from("pacientes").select("nome").eq("id", pacienteId).maybeSingle();
    nomePaciente = (paciente?.nome as string | null) ?? null;
  }

  const conversaEmbutida = execucao.conversas as { telefone: string } | { telefone: string }[] | null;
  const telefone = (Array.isArray(conversaEmbutida) ? conversaEmbutida[0]?.telefone : conversaEmbutida?.telefone) ?? "";

  // Cacheado em processo (buscarClinicaAtual) — custo real só na 1ª chamada.
  const clinicaAtual = await buscarClinicaAtual();

  return {
    execucaoId: execucao.id as string,
    clinicaId,
    fluxoId: execucao.fluxo_id as string,
    versaoId: execucao.versao_id as string,
    conversaId: execucao.conversa_id as string,
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

const ESTADOS_TERMINAIS: EstadoExecucao[] = ["completed", "cancelled", "failed", "transferred"];

/**
 * Processa UM passo de uma execução já reivindicada (estado já virou
 * `running`, `passos_executados` já incrementado por quem chamou). Faz o
 * `INSERT` do evento (`em_andamento` → `concluido`/`falhou`), chama a lógica
 * pura, checa opt-out antes de mandar mensagem, e persiste o resultado.
 * Compartilhada pelas 3 origens: poller, handoff síncrono do webhook, e o 1º
 * passo logo após `iniciarExecucaoFluxo`.
 */
async function processarPassoReivindicado(clinicaId: string, execucaoId: string, entrada: EntradaProcessamento): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const contexto = await carregarContextoExecucao(supabase, clinicaId, execucaoId);
  if (!contexto || !contexto.noAtualId) {
    await supabase
      .from("fluxo_execucoes")
      .update({ estado: "failed", erro: "contexto_invalido", finalizado_em: new Date().toISOString() })
      .eq("id", execucaoId);
    return;
  }

  const sequencia = contexto.passosExecutados; // já pós-incremento (feito pelo claim)
  const { error: erroEvento } = await supabase.from("fluxo_execucao_eventos").insert({
    execucao_id: execucaoId,
    clinica_id: clinicaId,
    sequencia,
    no_id: contexto.noAtualId,
    tipo_evento: "processando",
    status: "em_andamento",
    is_test: contexto.isTest,
  });
  if (erroEvento && erroEvento.code !== "23505") {
    console.error("[fluxo-execucoes] insert_evento_failed", JSON.stringify({ execucaoId, code: erroEvento.code }));
  }

  const contadores = await contarNo(supabase, execucaoId, contexto.noAtualId);
  // A visita/tentativa que este passo representa ainda não está no histórico
  // lido acima (o evento 'em_andamento' desta chamada foi gravado com
  // tipo_evento='processando', não com o tipo final) — contarNo reflete o
  // estado ANTES deste passo, que é exatamente o que `processarNo` espera.
  const resultado = processarNo(contexto.definicao, contexto.noAtualId, contexto.variaveis, entrada, contexto.paciente, contadores);

  if (!resultado.ok) {
    await supabase
      .from("fluxo_execucao_eventos")
      .update({ status: "falhou", erro: resultado.erro, updated_at: new Date().toISOString() })
      .eq("execucao_id", execucaoId)
      .eq("sequencia", sequencia);
    await supabase
      .from("fluxo_execucoes")
      .update({ estado: "failed", erro: resultado.erro, finalizado_em: new Date().toISOString() })
      .eq("id", execucaoId);
    await liberarControle(clinicaId, contexto.conversaId, { fluxo_execucao_ativa_id: null });
    return;
  }

  let donoTransferidoPorAcao = false;
  let variaveisExtra: Record<string, string> = {};
  if (resultado.acaoCrm) {
    const efeito = await aplicarAcaoCrm(
      supabase,
      clinicaId,
      contexto.conversaId,
      { pacienteId: contexto.pacienteId, fluxoId: contexto.fluxoId, execucaoId: contexto.execucaoId, variaveis: contexto.variaveis },
      resultado.acaoCrm
    );
    donoTransferidoPorAcao = efeito.donoTransferido;
    variaveisExtra = efeito.variaveisExtra ?? {};
  }

  // Opt-out checado AQUI, imediatamente antes de qualquer envio — nunca
  // reimplementa detecção, sempre reusa src/lib/opt-out.ts. Se o paciente já
  // saiu, a execução cancela em vez de mandar (a visão pede as duas coisas:
  // nunca enviar E cancelar pendências — o cancelamento no meio de uma espera
  // longa é coberto à parte, em `aplicarOptOut`, src/lib/opt-out.ts).
  if (resultado.mensagensParaEnviar.length > 0 && contexto.pacienteId) {
    const { data: paciente } = await supabase.from("pacientes").select("opt_out_em").eq("id", contexto.pacienteId).maybeSingle();
    if (paciente?.opt_out_em) {
      await supabase
        .from("fluxo_execucao_eventos")
        .update({ status: "falhou", erro: "opt_out", updated_at: new Date().toISOString() })
        .eq("execucao_id", execucaoId)
        .eq("sequencia", sequencia);
      await supabase
        .from("fluxo_execucoes")
        .update({ estado: "cancelled", erro: "opt_out", finalizado_em: new Date().toISOString() })
        .eq("id", execucaoId);
      await liberarControle(clinicaId, contexto.conversaId, { fluxo_execucao_ativa_id: null });
      return;
    }
  }

  // Canal da conversa resolvido UMA vez — o Fluxo responde pelo mesmo número por onde o paciente falou.
  const canalEnvio = resultado.mensagensParaEnviar.length > 0 ? await buscarCanalDaConversa(clinicaId, contexto.conversaId) : null;

  for (const texto of resultado.mensagensParaEnviar) {
    // Detecção de opt-out também vale pra resposta do PACIENTE que chega
    // dentro de um menu (entrada.tipo === 'resposta_texto') — mesmo
    // guard-rail do webhook, nunca reimplementado.
    if (entrada.tipo === "resposta_texto" && detectarPedidoOptOut(entrada.texto)) break;

    if (!canalEnvio) {
      console.error("[fluxo-execucoes] envio_falhou", JSON.stringify({ execucaoId, error: "canal_nao_encontrado" }));
      break;
    }
    const envio = await enviarComRetry(canalEnvio, contexto.paciente.telefone, texto);
    if (!envio.ok) {
      console.error("[fluxo-execucoes] envio_falhou", JSON.stringify({ execucaoId, error: envio.error ?? null }));
      continue; // 1 bloco falhando não derruba os outros nem o avanço do fluxo — mesmo critério de agentes.ts:enviarBlocos
    }
    const agora = new Date().toISOString();
    const { error: erroMensagem } = await supabase.from("mensagens").insert({
      clinica_id: clinicaId,
      conversa_id: contexto.conversaId,
      direcao: "enviada",
      tipo: "texto",
      conteudo: texto,
      evolution_message_id: envio.mensagemId ?? null,
      timestamp_whatsapp: agora,
    });
    if (erroMensagem && erroMensagem.code !== "23505") {
      console.error("[fluxo-execucoes] insert_mensagem_failed", JSON.stringify({ execucaoId, code: erroMensagem.code }));
    }
    await supabase.from("conversas").update({ ultima_mensagem_em: agora, updated_at: agora }).eq("id", contexto.conversaId);
  }

  const variaveisAtualizadas = { ...contexto.variaveis, ...resultado.variaveisAtualizadas, ...variaveisExtra };
  const terminou = ESTADOS_TERMINAIS.includes(resultado.novoEstado);

  await supabase
    .from("fluxo_execucoes")
    .update({
      estado: resultado.novoEstado,
      no_atual_id: resultado.proximoNoId,
      aguardando_ate: resultado.aguardandoAte,
      variaveis: variaveisAtualizadas,
      updated_at: new Date().toISOString(),
      ...(terminou ? { finalizado_em: new Date().toISOString(), motivo_finalizacao: resultado.motivoFinalizacao ?? null } : {}),
    })
    .eq("id", execucaoId);

  await supabase
    .from("fluxo_execucao_eventos")
    .update({
      status: "concluido",
      tipo_evento: resultado.tipoEvento,
      payload: resultado.payloadEvento ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq("execucao_id", execucaoId)
    .eq("sequencia", sequencia);

  if (terminou) {
    if (donoTransferidoPorAcao) {
      // iniciar_agente_ia já entregou dono_conversa pro agente (aplicarAcaoCrm,
      // acima) — chamar liberarControle aqui devolveria pro humano por cima
      // dessa entrega, um instante depois. Só solta o ponteiro da execução.
      await supabase
        .from("conversas")
        .update({ fluxo_execucao_ativa_id: null })
        .eq("id", contexto.conversaId)
        .eq("clinica_id", clinicaId);
    } else {
      await liberarControle(clinicaId, contexto.conversaId, { fluxo_execucao_ativa_id: null });
    }
  }
}

/**
 * Reivindica a próxima execução "due" pra esta clínica (poller) — `UPDATE`
 * condicional otimista, não uma CTE (ver nota de topo do arquivo). Se outro
 * processo reivindicou entre o `SELECT` e o `UPDATE`, a condição
 * `estado=<lido>` não bate, 0 linhas afetadas, devolve `null` (o poller
 * segue pro próximo ciclo, mesmo padrão de "lock ocupado" de
 * `disparos-worker.ts`). Decide `entrada` a partir do estado PRÉ-claim: só
 * `waiting_input` chega aqui por timeout vencido (resposta de verdade nunca
 * passa por esta função — usa `resolverRespostaWaitingInput`, sem filtro de
 * tempo).
 */
export async function reivindicarProximaExecucaoDue(clinicaId: string): Promise<{ execucaoId: string; entrada: EntradaProcessamento } | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const agora = new Date().toISOString();
  const { data: candidato } = await supabase
    .from("fluxo_execucoes")
    .select("id, estado, passos_executados")
    .eq("clinica_id", clinicaId)
    .or(`estado.eq.queued,and(estado.in.(waiting_time,waiting_input),aguardando_ate.lte.${agora})`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!candidato) return null;

  const estadoAntigo = candidato.estado as string;
  const { data: reivindicada, error } = await supabase
    .from("fluxo_execucoes")
    .update({ estado: "running", passos_executados: (candidato.passos_executados as number) + 1, updated_at: agora })
    .eq("id", candidato.id as string)
    .eq("estado", estadoAntigo)
    .select("id")
    .maybeSingle();

  if (error || !reivindicada) return null; // perdeu a corrida ou erro transiente — tenta de novo no próximo ciclo

  const entrada: EntradaProcessamento = estadoAntigo === "waiting_input" ? { tipo: "timeout" } : { tipo: "avancar" };
  return { execucaoId: candidato.id as string, entrada };
}

async function tentarReivindicarWaitingInput(clinicaId: string, execucaoId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return false;

  const { data: atual } = await supabase
    .from("fluxo_execucoes")
    .select("passos_executados")
    .eq("id", execucaoId)
    .eq("clinica_id", clinicaId)
    .eq("estado", "waiting_input")
    .maybeSingle();
  if (!atual) return false;

  const { data: reivindicada, error } = await supabase
    .from("fluxo_execucoes")
    .update({ estado: "running", passos_executados: (atual.passos_executados as number) + 1, updated_at: new Date().toISOString() })
    .eq("id", execucaoId)
    .eq("estado", "waiting_input")
    .select("id")
    .maybeSingle();
  return !error && Boolean(reivindicada);
}

/**
 * Claim usado pelo webhook quando uma resposta de VERDADE chega — sem
 * filtro de `aguardando_ate` nenhum (a mensagem chegando É o sinal de
 * prontidão, não o tempo; um menu sem timeout tem `aguardando_ate=null`, que
 * nunca bateria num filtro de tempo — ver crm/docs/fluxo-conversa-arquitetura.md).
 * 2 tentativas curtas antes de desistir: sem lock nenhum nesse caminho, uma
 * colisão rara com o worker processando o mesmo passo (ex.: timeout venceu
 * no instante exato em que a resposta chegou) não deveria virar "o bot não
 * respondeu" pro paciente por só alguns milissegundos de diferença.
 */
export async function resolverRespostaWaitingInput(clinicaId: string, execucaoId: string, texto: string): Promise<boolean> {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    if (await tentarReivindicarWaitingInput(clinicaId, execucaoId)) {
      await processarPassoReivindicado(clinicaId, execucaoId, { tipo: "resposta_texto", texto });
      return true;
    }
    if (tentativa < 2) await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
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
    ? supabase.from("fluxo_versoes").select("id, definicao").eq("id", versaoIdForcada).eq("fluxo_id", fluxoId).maybeSingle()
    : supabase.from("fluxo_versoes").select("id, definicao").eq("fluxo_id", fluxoId).eq("status", "publicada").maybeSingle());
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
  await processarPassoReivindicado(clinicaId, execucaoId, { tipo: "avancar" });

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
  await processarPassoReivindicado(clinicaId, reivindicada.execucaoId, reivindicada.entrada);
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

  const corte = new Date(Date.now() - JANELA_GRACA_RECOVERY_MS).toISOString();
  let recuperadas = 0;

  const { data: eventosPresos } = await supabase
    .from("fluxo_execucao_eventos")
    .select("id, execucao_id")
    .eq("status", "em_andamento")
    .lt("created_at", corte);

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
    .lt("updated_at", corte);

  for (const execucao of execucoesPresas ?? []) {
    recuperadas += await falharExecucaoPresa(supabase, execucao.id as string);
  }

  if (recuperadas > 0) console.log("[fluxo-execucoes] recovery_apos_restart", JSON.stringify({ recuperadas }));
  return { recuperadas };
}

async function falharExecucaoPresa(supabase: SupabaseClient, execucaoId: string): Promise<number> {
  const { data: execucao } = await supabase
    .from("fluxo_execucoes")
    .select("id, clinica_id, conversa_id")
    .eq("id", execucaoId)
    .eq("estado", "running")
    .maybeSingle();
  if (!execucao) return 0; // já recuperada por outra via, ou terminou normalmente entretanto

  await supabase
    .from("fluxo_execucoes")
    .update({ estado: "failed", erro: "recovery_apos_restart", finalizado_em: new Date().toISOString() })
    .eq("id", execucaoId);
  await liberarControle(execucao.clinica_id as string, execucao.conversa_id as string, { fluxo_execucao_ativa_id: null });
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
