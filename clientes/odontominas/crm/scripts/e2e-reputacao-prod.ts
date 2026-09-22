/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Validação controlada da Reputação em produção.
 * Usa exclusivamente o paciente autorizado `Rafael (teste Disparos)` e deixa
 * três mensagens prefixadas com [TESTE]. Ao final, pausa os fluxos e restaura
 * a configuração anterior; as evidências de execução permanecem auditáveis.
 */
import { readFileSync } from "node:fs";

async function main(): Promise<void> {
for (const linha of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  if (!linha || linha.startsWith("#") || !linha.includes("=")) continue;
  const indice = linha.indexOf("=");
  const chave = linha.slice(0, indice).trim();
  if (!(chave in process.env)) process.env[chave] = linha.slice(indice + 1).trim().replace(/^["']|["']$/g, "");
}

const { getSupabaseServerClient } = await import("@/lib/supabase");
const { getClinicaId } = await import("@/lib/clinica");
const { gerarDefinicaoInicial } = await import("@/lib/fluxo-templates");
const { criarFluxoComRascunhoInicial, salvarRascunho, publicarFluxo, atualizarStatusFluxo } = await import("@/lib/fluxo-versoes");
const { emitirEventoAutomacao } = await import("@/lib/fluxo-eventos-internos");
const { resolverRespostaWaitingInput, processarProximoPassoDevido } = await import("@/lib/fluxo-execucoes");
const { registrarAtendimentoFinalizadoPorEtiqueta } = await import("@/lib/reputacao-atendimentos");
const { buscarConfigReputacao, salvarConfigReputacao } = await import("@/lib/reputacao-config");
const { solicitarAvaliacaoGoogle } = await import("@/lib/reputacao-solicitacao");
const { atualizarRecuperacao } = await import("@/lib/reputacao-recuperacoes");

const db: any = getSupabaseServerClient();
const clinicaId = (await getClinicaId()) as string;
if (!db || !clinicaId) throw new Error("backend_unavailable");

const PREFIXO = "[TESTE] Reputação E2E";
const log = (etapa: string, dados: unknown) => console.log(JSON.stringify({ etapa, dados }));
const falhar = (mensagem: string): never => { throw new Error(mensagem); };
const conferir = (ok: unknown, mensagem: string) => { if (!ok) falhar(mensagem); };

const { data: admin }: any = await db.from("atendentes").select("id").eq("clinica_id", clinicaId).eq("nome", "[TESTE] Noryos Admin").single();
const { data: paciente }: any = await db.from("pacientes").select("id,nome,telefone").eq("clinica_id", clinicaId).eq("nome", "Rafael (teste Disparos)").single();
if (!admin || !paciente || paciente.telefone !== "5561981925241") falhar("contato_teste_nao_autorizado");
const { data: conversa }: any = await db.from("conversas").select("id").eq("clinica_id", clinicaId).eq("paciente_id", paciente.id).order("updated_at", { ascending: false }).limit(1).single();
if (!conversa) falhar("conversa_teste_ausente");
const { data: fluxosPendentes }: any = await db.from("fluxos").select("id").eq("clinica_id", clinicaId).ilike("nome", `${PREFIXO}%`).eq("status", "ativo");
for (const fluxo of fluxosPendentes ?? []) await atualizarStatusFluxo(clinicaId, fluxo.id as string, "pausado", admin.id as string, true);

const original = await buscarConfigReputacao(clinicaId);
const agora = Date.now();
const idsFluxo: string[] = [];
const idsAtendimento: string[] = [];

if (process.env.E2E_REPUTACAO_VERIFICAR === "true") {
  const { data: pesquisas } = await db.from("pesquisas").select("id,status,referencia_id,enviado_em").eq("clinica_id", clinicaId).eq("tipo", "satisfacao").order("created_at", { ascending: false }).limit(3);
  const ids = (pesquisas ?? []).map((p: any) => p.id as string);
  const { data: respostas } = ids.length ? await db.from("pesquisa_respostas").select("pesquisa_id,classificacao,valor_texto").in("pesquisa_id", ids) : { data: [] };
  const { data: recuperacoes } = ids.length ? await db.from("recuperacao_experiencias").select("id,pesquisa_id,status,resposta_original,motivo").in("pesquisa_id", ids) : { data: [] };
  const { data: pesquisasGoogle } = await db.from("pesquisas").select("id,status,enviado_em,created_at").eq("clinica_id", clinicaId).eq("tipo", "avaliacao_google").order("created_at", { ascending: false }).limit(3);
  const { data: mensagensRecentes } = await db.from("mensagens").select("id,conteudo,evolution_message_id,created_at,raw").eq("conversa_id", conversa.id).eq("clinica_id", clinicaId).order("created_at", { ascending: false }).limit(8);
  const { data: execucoesGoogle } = await db.from("fluxo_execucoes").select("id,estado,erro,motivo_finalizacao,created_at").eq("clinica_id", clinicaId).order("created_at", { ascending: false }).limit(8);
  log("evidencias_existentes", { pesquisas, respostas, recuperacoes, pesquisasGoogle, mensagensRecentes, execucoesGoogle });
  return;
}

function comMarcacaoTeste(templateId: string) {
  const definicao: any = gerarDefinicaoInicial(templateId);
  return {
    ...definicao,
    nodes: definicao.nodes.map((no: any) => {
      if (no.tipo === "mensagem" || no.tipo === "capturar_resposta" || no.tipo === "transferir_humano") {
        return { ...no, ...(no.texto ? { texto: `[TESTE] ${no.texto}` } : {}), ...(no.mensagem ? { mensagem: `[TESTE] ${no.mensagem}` } : {}) };
      }
      return no;
    }),
  };
}

async function criarFluxoTeste(nome: string, templateId: string, gatilho: string): Promise<string> {
  const criado: any = await criarFluxoComRascunhoInicial(clinicaId, { nome, descricao: "Validação controlada; pausar ao final.", templateId }, admin.id as string);
  if (!criado.ok || !criado.id) falhar(`criar_fluxo:${criado.error ?? "desconhecido"}`);
  const salvo: any = await salvarRascunho(clinicaId, criado.id, comMarcacaoTeste(templateId));
  if (!salvo.ok || salvo.erros?.length) falhar(`rascunho_fluxo:${salvo.error ?? salvo.erros?.map((e: any) => e.codigo).join(",")}`);
  const publicado = await publicarFluxo(clinicaId, criado.id, admin.id as string);
  if (!publicado.ok) falhar(`publicar_fluxo:${publicado.error ?? "desconhecido"}`);
  const { error: erroGatilho } = await db.from("fluxos").update({ gatilho_tipo: gatilho, gatilho_config: {}, updated_at: new Date().toISOString() }).eq("id", criado.id).eq("clinica_id", clinicaId);
  if (erroGatilho) falhar("gatilho_fluxo");
  const ativo = await atualizarStatusFluxo(clinicaId, criado.id, "ativo", admin.id as string);
  if (!ativo.ok) falhar(`ativar_fluxo:${ativo.error ?? "desconhecido"}`);
  const { data: fluxoAtivo } = await db.from("fluxos").select("status,gatilho_tipo").eq("id", criado.id).eq("clinica_id", clinicaId).single();
  log("diagnostico_fluxo", { criado: criado.id, gatilhoEsperado: gatilho, fluxoAtivo });
  idsFluxo.push(criado.id);
  conferir(fluxoAtivo?.status === "ativo" && fluxoAtivo?.gatilho_tipo === gatilho, "fluxo_nao_ativado");
  return criado.id;
}

async function processarAte(execucaoId: string, estado: string, maximo = 8): Promise<Record<string, unknown>> {
  for (let tentativa = 0; tentativa < maximo; tentativa++) {
    const { data } = await db.from("fluxo_execucoes").select("estado,no_atual_id,variaveis,erro,motivo_finalizacao").eq("id", execucaoId).single();
    if (data?.estado === estado) return data as Record<string, unknown>;
    await processarProximoPassoDevido(clinicaId);
  }
  const { data } = await db.from("fluxo_execucoes").select("estado,no_atual_id,variaveis,erro,motivo_finalizacao").eq("id", execucaoId).single();
  return (data ?? {}) as Record<string, unknown>;
}

async function restaurar(): Promise<void> {
  await Promise.all(idsFluxo.map((id) => atualizarStatusFluxo(clinicaId, id, "pausado", admin.id as string, true)));
  if (idsAtendimento.length) await db.from("reputacao_agendamentos").update({ status: "cancelado", updated_at: new Date().toISOString() }).in("atendimento_id", idsAtendimento).eq("status", "pendente");
  await salvarConfigReputacao(clinicaId, {
    ativo: original.ativo, googleReviewUrl: original.googleReviewUrl, rastrearCliques: original.rastrearCliques,
    delayHorasPadrao: original.delayHorasPadrao, automacaoAtendimentoConcluidoAtiva: original.automacaoAtendimentoConcluidoAtiva,
    pesquisaAtiva: original.pesquisaAtiva, pesquisaDelayMinutos: original.pesquisaDelayMinutos,
    googleAtivo: original.googleAtivo, googleDelayMinutos: original.googleDelayMinutos, alertaRecuperacaoAtivo: original.alertaRecuperacaoAtivo,
  });
}

if (process.env.E2E_REPUTACAO_CONTINUAR === "true") {
  const inicioContinuacao = new Date().toISOString();
  const { data: pesquisaExperiencia }: any = await db.from("pesquisas")
    .select("id,referencia_id,status")
    .eq("clinica_id", clinicaId)
    .eq("tipo", "satisfacao")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  conferir(pesquisaExperiencia?.status === "respondida", "pesquisa_existente_nao_respondida");
  const { data: respostaExperiencia }: any = await db.from("pesquisa_respostas")
    .select("classificacao,valor_texto")
    .eq("pesquisa_id", pesquisaExperiencia.id)
    .single();
  conferir(respostaExperiencia?.classificacao === "poderia_melhorar", "classificacao_existente_invalida");
  const { data: recuperacaoExistente }: any = await db.from("recuperacao_experiencias")
    .select("id,status,resposta_original")
    .eq("pesquisa_id", pesquisaExperiencia.id)
    .single();
  conferir(recuperacaoExistente?.status === "aberto", "recuperacao_existente_invalida");

  const { data: fluxosTeste }: any = await db.from("fluxos")
    .select("id,nome,gatilho_tipo,status,updated_at")
    .eq("clinica_id", clinicaId)
    .ilike("nome", `${PREFIXO}%`)
    .order("updated_at", { ascending: false });
  const fluxoExperiencia = (fluxosTeste ?? []).find((fluxo: any) => fluxo.gatilho_tipo === "atendimento_concluido");
  const fluxoGoogle = (fluxosTeste ?? []).find((fluxo: any) => fluxo.gatilho_tipo === "solicitacao_avaliacao_google");
  conferir(fluxoExperiencia?.id && fluxoGoogle?.id, "fluxos_teste_existentes_ausentes");
  idsFluxo.push(fluxoExperiencia.id as string, fluxoGoogle.id as string);

  try {
    conferir((await atualizarRecuperacao(clinicaId, recuperacaoExistente.id as string, admin.id as string, true, {
      status: "em_tratativa", motivo: "tempo_espera", observacoesInternas: "[TESTE] retorno iniciado",
    })).ok, "tratativa_recuperacao");
    conferir((await atualizarRecuperacao(clinicaId, recuperacaoExistente.id as string, admin.id as string, true, {
      status: "resolvido", motivo: "tempo_espera", solucao: "[TESTE] contato e solução registrados",
    })).ok, "resolucao_recuperacao");
    const { data: recuperacaoResolvida }: any = await db.from("recuperacao_experiencias")
      .select("status,motivo,solucao,resolvido_em")
      .eq("id", recuperacaoExistente.id)
      .single();
    conferir(recuperacaoResolvida?.status === "resolvido" && recuperacaoResolvida?.resolvido_em, "recuperacao_nao_resolvida");

    conferir((await atualizarStatusFluxo(clinicaId, fluxoExperiencia.id as string, "ativo", admin.id as string)).ok, "reativar_fluxo_experiencia");
    conferir((await atualizarStatusFluxo(clinicaId, fluxoGoogle.id as string, "ativo", admin.id as string)).ok, "reativar_fluxo_google");
    conferir((await salvarConfigReputacao(clinicaId, {
      ativo: true, googleReviewUrl: original.googleReviewUrl, rastrearCliques: original.rastrearCliques,
      delayHorasPadrao: original.delayHorasPadrao, automacaoAtendimentoConcluidoAtiva: false,
      pesquisaAtiva: false, pesquisaDelayMinutos: original.pesquisaDelayMinutos,
      googleAtivo: true, googleDelayMinutos: original.googleDelayMinutos, alertaRecuperacaoAtivo: original.alertaRecuperacaoAtivo,
    })).ok, "configuracao_continuacao");

    const google: any = await solicitarAvaliacaoGoogle(clinicaId, paciente.id as string);
    conferir(google.ok, `convite_google:${google.ok ? "" : google.error}`);
    const { data: execucaoGoogle }: any = await db.from("fluxo_execucoes")
      .select("id,estado")
      .eq("clinica_id", clinicaId)
      .eq("fluxo_id", fluxoGoogle.id)
      .gte("created_at", inicioContinuacao)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    conferir(execucaoGoogle?.id, "execucao_google_ausente");
    const finalGoogle = await processarAte(execucaoGoogle.id as string, "completed");
    conferir(finalGoogle.estado === "completed", "convite_google_nao_concluido");
    const { data: solicitacaoGoogle }: any = await db.from("pesquisas")
      .select("id,status,enviado_em")
      .eq("clinica_id", clinicaId)
      .eq("tipo", "avaliacao_google")
      .gte("created_at", inicioContinuacao)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    conferir(solicitacaoGoogle?.status === "enviada" && solicitacaoGoogle?.enviado_em, "solicitacao_google_nao_enviada");

    const repetido: any = await emitirEventoAutomacao({
      clinicaId, pacienteId: paciente.id as string, tipo: "atendimento_concluido",
      referenciaId: pesquisaExperiencia.referencia_id as string,
      metadata: { atendimento_id: pesquisaExperiencia.referencia_id as string },
    });
    conferir(repetido.resultado === "idempotencia_existente", "dedupe_evento_interno");
    const { data: mensagens }: any = await db.from("mensagens")
      .select("conteudo,evolution_message_id,created_at")
      .eq("conversa_id", conversa.id)
      .eq("clinica_id", clinicaId)
      .gte("created_at", inicioContinuacao)
      .order("created_at");
    const mensagensTeste = (mensagens ?? []).filter((mensagem: any) => String(mensagem.conteudo).startsWith("[TESTE]"));
    conferir(mensagensTeste.length === 1 && mensagensTeste[0].evolution_message_id, "convite_google_nao_confirmado_pelo_provedor");
    log("continuacao_validada", { respostaExperiencia, recuperacaoResolvida, execucaoGoogle, finalGoogle, solicitacaoGoogle, repetido, mensagensTeste });
    log("resultado", { ok: true, recuperacaoId: recuperacaoExistente.id, solicitacaoGoogleId: solicitacaoGoogle.id, execucaoGoogleId: execucaoGoogle.id });
  } finally {
    await restaurar();
    log("limpeza", { fluxosPausados: idsFluxo, configRestaurada: true });
  }
  return;
}

try {
  const [fluxoExperiencia, fluxoGoogle] = await Promise.all([
    criarFluxoTeste(`${PREFIXO} experiência ${agora}`, "pesquisa-experiencia-paciente", "atendimento_concluido"),
    criarFluxoTeste(`${PREFIXO} Google ${agora}`, "solicitacao-avaliacao-google", "solicitacao_avaliacao_google"),
  ]);
  log("fluxos_publicados", { fluxoExperiencia, fluxoGoogle });

  const configTeste = {
    ativo: true, googleReviewUrl: original.googleReviewUrl, rastrearCliques: original.rastrearCliques,
    delayHorasPadrao: original.delayHorasPadrao, automacaoAtendimentoConcluidoAtiva: false,
    pesquisaAtiva: true, pesquisaDelayMinutos: 1440, googleAtivo: true, googleDelayMinutos: 1440, alertaRecuperacaoAtivo: true,
  };
  conferir((await salvarConfigReputacao(clinicaId, configTeste)).ok, "configuracao_teste");

  const etiquetaId = crypto.randomUUID();
  await registrarAtendimentoFinalizadoPorEtiqueta(clinicaId, conversa.id as string, etiquetaId);
  await registrarAtendimentoFinalizadoPorEtiqueta(clinicaId, conversa.id as string, etiquetaId);
  const referenciaEtiqueta = `etiqueta:${conversa.id}:${etiquetaId}`;
  const { data: atendimentosEtiqueta } = await db.from("reputacao_atendimentos").select("id").eq("clinica_id", clinicaId).eq("origem_referencia", referenciaEtiqueta);
  conferir(atendimentosEtiqueta?.length === 1, "dedupe_atendimento_finalizado");
  const atendimentoEtiquetaId = atendimentosEtiqueta![0].id as string;
  idsAtendimento.push(atendimentoEtiquetaId);
  const { data: agendamento } = await db.from("reputacao_agendamentos").select("id,status,devido_em").eq("atendimento_id", atendimentoEtiquetaId).eq("tipo", "google").single();
  const { data: execucaoAgendada } = await db.from("fluxo_execucoes").select("id,estado,aguardando_ate").eq("gatilho_ref_id", atendimentoEtiquetaId).eq("fluxo_id", fluxoExperiencia).single();
  const { data: eventoAgendado } = await db.from("automacao_eventos").select("resultado,detalhe,execucao_id,fluxo_id,created_at").eq("referencia_id", atendimentoEtiquetaId).eq("evento_tipo", "atendimento_concluido").order("created_at", { ascending: false }).limit(1).maybeSingle();
  log("diagnostico_agendamento", { agendamento, execucaoAgendada, eventoAgendado });
  conferir(agendamento?.status === "pendente" && ["queued", "waiting_time"].includes(String(execucaoAgendada?.estado)) && Date.parse(String(execucaoAgendada?.aguardando_ate)) > Date.now(), "agenda_horario_comercial");
  log("atendimento_finalizado_agendado", { atendimentoEtiquetaId, agendamento, execucaoAgendada });
  conferir((await atualizarStatusFluxo(clinicaId, fluxoExperiencia, "pausado", admin.id as string, true)).ok, "interromper_agendamento_teste");
  conferir((await atualizarStatusFluxo(clinicaId, fluxoExperiencia, "ativo", admin.id as string)).ok, "reativar_fluxo_experiencia");

  // A mensagem real só ocorre abaixo, após o usuário confirmar a execução deste roteiro.
  const referenciaPesquisa = `manual:${crypto.randomUUID()}`;
  const { data: atendimentoPesquisa, error: erroAtendimentoPesquisa } = await db.from("reputacao_atendimentos").insert({ clinica_id: clinicaId, paciente_id: paciente.id, conversa_id: conversa.id, origem: "manual", origem_referencia: referenciaPesquisa }).select("id").single();
  if (erroAtendimentoPesquisa || !atendimentoPesquisa) falhar("atendimento_pesquisa");
  idsAtendimento.push(atendimentoPesquisa.id as string);
  const inicioPesquisa: any = await emitirEventoAutomacao({ clinicaId, pacienteId: paciente.id as string, tipo: "atendimento_concluido", referenciaId: atendimentoPesquisa.id as string, metadata: { atendimento_id: atendimentoPesquisa.id as string } });
  conferir(inicioPesquisa.resultado === "execucao_iniciada" && inicioPesquisa.execucaoId, "inicio_pesquisa");
  const esperando = await processarAte(inicioPesquisa.execucaoId!, "waiting_input");
  conferir(esperando.estado === "waiting_input", "pesquisa_nao_entrou_em_espera");
  log("pesquisa_enviada", { execucaoId: inicioPesquisa.execucaoId, esperando });

  conferir(await resolverRespostaWaitingInput(clinicaId, inicioPesquisa.execucaoId!, "Poderia melhorar: demorou muito."), "resposta_nao_processada");
  const finalPesquisa = await processarAte(inicioPesquisa.execucaoId!, "transferred");
  conferir(finalPesquisa.estado === "transferred", "recuperacao_nao_transferida");
  const { data: pesquisa } = await db.from("pesquisas").select("id,status").eq("clinica_id", clinicaId).eq("referencia_id", atendimentoPesquisa.id as string).eq("tipo", "satisfacao").single();
  const { data: resposta } = pesquisa ? await db.from("pesquisa_respostas").select("classificacao,valor_texto").eq("pesquisa_id", pesquisa.id).single() : { data: null };
  const { data: recuperacao } = pesquisa ? await db.from("recuperacao_experiencias").select("id,status,resposta_original").eq("pesquisa_id", pesquisa.id).single() : { data: null };
  conferir(resposta?.classificacao === "poderia_melhorar" && recuperacao?.status === "aberto", "classificacao_ou_recuperacao");
  conferir((await atualizarRecuperacao(clinicaId, recuperacao!.id as string, admin.id as string, true, { status: "em_tratativa", motivo: "tempo_espera", observacoesInternas: "[TESTE] retorno iniciado" })).ok, "tratativa_recuperacao");
  conferir((await atualizarRecuperacao(clinicaId, recuperacao!.id as string, admin.id as string, true, { status: "resolvido", motivo: "tempo_espera", solucao: "[TESTE] contato e solução registrados" })).ok, "resolucao_recuperacao");
  const { data: alerta } = await db.from("alertas").select("id,status,tipo").eq("clinica_id", clinicaId).eq("tipo", "experiencia_insatisfatoria").order("created_at", { ascending: false }).limit(1).maybeSingle();
  conferir(alerta?.tipo === "experiencia_insatisfatoria", "alerta_recuperacao");
  log("recuperacao_concluida", { pesquisa, resposta, recuperacao, alerta, finalPesquisa });

  const google: any = await solicitarAvaliacaoGoogle(clinicaId, paciente.id as string);
  conferir(google.ok, `convite_google:${google.ok ? "" : google.error}`);
  const { data: execucaoGoogle } = await db.from("fluxo_execucoes").select("id,estado").eq("clinica_id", clinicaId).eq("fluxo_id", fluxoGoogle).order("created_at", { ascending: false }).limit(1).single();
  const finalGoogle = await processarAte(execucaoGoogle.id as string, "completed");
  conferir(finalGoogle.estado === "completed", "convite_google_nao_concluido");
  const { data: solicitacaoGoogle } = await db.from("pesquisas").select("id,status").eq("clinica_id", clinicaId).eq("tipo", "avaliacao_google").order("created_at", { ascending: false }).limit(1).single();
  conferir(solicitacaoGoogle?.status === "enviada", "solicitacao_google_nao_enviada");
  log("convite_google_enviado", { execucaoGoogle, finalGoogle, solicitacaoGoogle });

  const repetido: any = await emitirEventoAutomacao({ clinicaId, pacienteId: paciente.id as string, tipo: "atendimento_concluido", referenciaId: atendimentoPesquisa.id as string, metadata: { atendimento_id: atendimentoPesquisa.id as string } });
  conferir(repetido.resultado === "idempotencia_existente", "dedupe_evento_interno");
  const { data: mensagens } = await db.from("mensagens").select("conteudo,evolution_message_id,created_at").eq("conversa_id", conversa.id).eq("clinica_id", clinicaId).gte("created_at", new Date(agora - 60_000).toISOString()).order("created_at");
  conferir((mensagens ?? []).filter((m: any) => String(m.conteudo).startsWith("[TESTE]")).length >= 3, "mensagens_teste_nao_confirmadas");
  log("mensagens_confirmadas", mensagens);
  log("resultado", { ok: true, fluxoExperiencia, fluxoGoogle, execucaoPesquisa: inicioPesquisa.execucaoId, recuperacaoId: recuperacao!.id, solicitacaoGoogleId: solicitacaoGoogle!.id });
} finally {
  await restaurar();
  log("limpeza", { fluxosPausados: idsFluxo, atendimentosComAgendaCancelada: idsAtendimento, configRestaurada: true });
}
}

void main();
