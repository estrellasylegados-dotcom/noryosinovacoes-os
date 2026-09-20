import { getSupabaseServerClient } from "@/lib/supabase";
import { agendamentoComercial, chaveComercial, combinaEventoComercial, lerConfigComercial, type EventoKanban, type ConfigComercial } from "@/lib/fluxo-comercial-regras";
import { abrirAlertaPorEvento } from "@/lib/alertas";
import { avaliarStatusSlaConversa } from "@/lib/sla";
import type { FluxoDefinicao } from "@/lib/fluxo-tipos";

export function automacoesComerciaisHabilitadas(): boolean { return process.env.AUTOMACOES_KANBAN_ENABLED === "true"; }
type Db = NonNullable<ReturnType<typeof getSupabaseServerClient>>;
export type ContextoComercial = {
  eventoId: string; etapaId: string; entradaEm: string; status: string; config: ConfigComercial; cadeia: string[];
};

/** Consome a outbox existente dentro do ciclo do fluxo-worker. Não é um novo worker. */
export async function processarEventoComercial(clinicaId: string): Promise<boolean> {
  if (!automacoesComerciaisHabilitadas()) return false;
  const db = getSupabaseServerClient();
  if (!db) return false;
  const { data, error } = await db.rpc("fluxo_reivindicar_evento", { p_clinica: clinicaId });
  if (error) throw new Error("evento_claim_falhou");
  if (!data) return false;
  const ev = data as { id: string; entrega_token: string; entrega_tentativas: number; detalhe: EventoKanban & { destinos: { fluxo_id: string; versao_id: string; config: unknown }[] } };
  try {
    for (const alvo of ev.detalhe.destinos) {
      const config = lerConfigComercial(alvo.config);
      if (!config || !combinaEventoComercial(config, ev.detalhe, alvo.fluxo_id)) continue;
      const r = await db.rpc("fluxo_iniciar_comercial", {
        p_clinica: clinicaId, p_fluxo: alvo.fluxo_id, p_versao: alvo.versao_id, p_evento: ev.id,
        p_config: config, p_dedupe: chaveComercial(config, ev.detalhe), p_agendado: agendamentoComercial(config, ev.detalhe),
      });
      if (r.error) throw new Error("evento_inicio_falhou");
      const inicio = r.data as { ok: boolean; execucaoId?: string; deduplicado?: boolean; error?: string };
      await db.from("automacao_eventos").insert({ clinica_id: clinicaId, paciente_id: ev.detalhe.paciente_id,
        fluxo_id: alvo.fluxo_id, execucao_id: inicio.execucaoId ?? null, evento_tipo: "kanban_stage_changed", referencia_id: ev.detalhe.id,
        resultado: inicio.deduplicado ? "idempotencia_existente" : inicio.ok ? "execucao_iniciada" : "paciente_nao_elegivel",
        detalhe: { oportunidade_id: ev.detalhe.oportunidade_id, motivo: inicio.error ?? null, versao_id: alvo.versao_id } });
      console.log("[fluxo] evento_comercial", JSON.stringify({ eventoId: ev.id, fluxoId: alvo.fluxo_id, execucaoId: inicio.execucaoId, dedupe: inicio.deduplicado, motivo: inicio.error }));
    }
    const fim = await db.from("automacao_eventos").update({ entrega_estado: "concluido", entrega_token: null, entrega_apos: null }).eq("id", ev.id).eq("clinica_id", clinicaId).eq("entrega_token", ev.entrega_token);
    if (fim.error) throw new Error("evento_confirmacao_falhou");
  } catch {
    const esgotou = ev.entrega_tentativas >= 5;
    await db.from("automacao_eventos").update({ entrega_estado: esgotou ? "falhou" : "pendente", entrega_token: null,
      entrega_apos: new Date(Date.now() + Math.min(300, 5 * 2 ** ev.entrega_tentativas) * 1000).toISOString() }).eq("id", ev.id).eq("clinica_id", clinicaId).eq("entrega_token", ev.entrega_token);
    if (esgotou) await abrirAlertaPorEvento(clinicaId, { tipo: "automacao_indisponivel", chave: `evento_kanban:${ev.id}`, severidade: "atencao",
      titulo: "Uma automação precisa de atenção", descricao: "Não foi possível iniciar o acompanhamento de uma oportunidade. Peça à equipe responsável para conferir.",
      tipoEntidade: "clinica", entidadeId: clinicaId, responsavelId: null, dados: { eventoId: ev.id } });
  }
  return true;
}

/** Variáveis derivadas do estado ATUAL, nunca do snapshot do evento. */
export async function carregarVariaveisComerciais(db: Db, clinicaId: string, oportunidadeId: string, conversaId: string | null, marco: string, execucaoId: string): Promise<Record<string, string>> {
  const { data: o, error } = await db.from("oportunidades").select("paciente_id,pipeline_id,estagio_id,status,responsavel_id,interesse,motivo_perda_id,estagio_entrou_em").eq("id", oportunidadeId).eq("clinica_id", clinicaId).maybeSingle();
  if (error || !o) throw new Error("contexto_comercial_invalido");
  const [etapa, responsavel, paciente, conversa, respostas, envios, etiquetas] = await Promise.all([
    db.from("pipeline_estagios").select("nome").eq("id", o.estagio_id).eq("clinica_id", clinicaId).maybeSingle(),
    o.responsavel_id ? db.from("atendentes").select("nome").eq("id", o.responsavel_id).eq("clinica_id", clinicaId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db.from("pacientes").select("origem_lead,utm_source").eq("id", o.paciente_id).eq("clinica_id", clinicaId).maybeSingle(),
    conversaId ? db.from("conversas").select("canal_id,ultima_mensagem_em").eq("id", conversaId).eq("clinica_id", clinicaId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    conversaId ? db.from("mensagens").select("id").eq("clinica_id", clinicaId).eq("conversa_id", conversaId).eq("direcao", "recebida").gt("created_at", marco).limit(1) : Promise.resolve({ data: [], error: null }),
    db.from("fluxo_execucao_eventos").select("id", { count: "exact", head: true }).eq("execucao_id", execucaoId).eq("clinica_id", clinicaId).eq("tipo_evento", "mensagem_enviada").eq("status", "concluido"),
    conversaId ? db.from("conversa_etiquetas").select("etiqueta_id").eq("conversa_id", conversaId) : Promise.resolve({ data: [], error: null }),
  ]);
  if ([etapa,responsavel,paciente,conversa,respostas,envios,etiquetas].some(r => r.error)) throw new Error("contexto_comercial_indisponivel");
  const sla = conversaId ? await avaliarStatusSlaConversa(clinicaId, conversaId, new Date()) : null;
  return {
    oportunidade_id: oportunidadeId, oportunidade: o.interesse || "Oportunidade", interesse: o.interesse ?? "", tratamento: o.interesse ?? "",
    etapa: etapa.data?.nome ?? "", oportunidade_etapa_id: o.estagio_id, oportunidade_pipeline_id: o.pipeline_id,
    oportunidade_aberta: String(o.status === "open"), responsavel_id: o.responsavel_id ?? "", responsavel: responsavel.data?.nome ?? "",
    motivo_perda_id: o.motivo_perda_id ?? "", origem_lead: paciente.data?.origem_lead ?? paciente.data?.utm_source ?? "",
    canal_id: conversa.data?.canal_id ?? "", ultima_interacao_em: conversa.data?.ultima_mensagem_em ?? "",
    paciente_respondeu: String((respostas.data?.length ?? 0) > 0), tentativas: String(envios.count ?? 0),
    tempo_etapa_segundos: String(Math.max(0, Math.floor((Date.now() - Date.parse(o.estagio_entrou_em)) / 1000))),
    etiquetas: (etiquetas.data ?? []).map(e => e.etiqueta_id).join(","), sla: sla?.tipo ?? "sem_ciclo",
  };
}

/** Valida referências no servidor antes de publicar, inclusive JSON enviado fora do editor. */
export async function validarReferenciasComerciais(clinicaId: string, definicao: FluxoDefinicao): Promise<string | null> {
  const gatilho = definicao.config.gatilho as { tipo?: string; config?: unknown } | undefined;
  if (gatilho?.tipo !== "kanban_stage_changed") return definicao.nodes.some(n => n.tipo === "acao_comercial") ? "acao_exige_oportunidade" : null;
  const config = lerConfigComercial(gatilho.config);
  if (!config) return "gatilho_comercial_invalido";
  const db = getSupabaseServerClient();
  if (!db) return "backend_unavailable";
  const pipeline = await db.from("pipelines").select("id").eq("id", config.pipelineId).eq("clinica_id", clinicaId).eq("ativo", true).maybeSingle();
  if (!pipeline.data || pipeline.error) return "pipeline_invalido";
  const etapas = await db.from("pipeline_estagios").select("id,tipo").eq("pipeline_id", config.pipelineId).eq("clinica_id", clinicaId).eq("ativo", true);
  if (etapas.error || (config.etapaId && !etapas.data?.some(e => e.id === config.etapaId))) return "etapa_invalida";
  for (const no of definicao.nodes) {
    // Legado continua disponível nos fluxos conversacionais. Não usar o bloco de WhatsApp interno como Central.
    if (["criar_alerta_interno", "iniciar_agente_ia", "mudar_status", "pausar_automacao"].includes(no.tipo)) return "acao_incompativel_comercial";
    if (no.tipo === "acao_comercial" && no.acao === "mover_oportunidade") {
      const destino = etapas.data?.find(e => e.id === no.valor);
      if (!destino) return "etapa_destino_invalida";
      if (destino.tipo === "lost") {
        const motivo = await db.from("motivos_perda").select("id").eq("id", no.motivoPerdaId ?? "").eq("clinica_id", clinicaId).eq("ativo", true).maybeSingle();
        if (!motivo.data || motivo.error) return "motivo_perda_obrigatorio";
      }
    }
    if (no.tipo === "adicionar_etiqueta" || no.tipo === "remover_etiqueta") {
      const e = await db.from("etiquetas").select("id").eq("id", no.etiquetaId).eq("clinica_id", clinicaId).maybeSingle();
      if (!e.data || e.error) return "etiqueta_invalida";
    }
    const responsavel = no.tipo === "acao_comercial" && no.acao === "responsavel" ? no.valor : no.tipo === "atribuir_atendente" ? no.atendenteId : null;
    if (responsavel) {
      const r = await db.from("atendentes").select("id").eq("id", responsavel).eq("clinica_id", clinicaId).eq("status", "active").maybeSingle();
      if (!r.data || r.error) return "responsavel_invalido";
    }
  }
  return null;
}
