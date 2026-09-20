import { can } from "@/lib/autorizacao";
import type { SessaoAtual } from "@/lib/sessao-servidor";
import { PERFIS_PLATAFORMA, type Permissao } from "@/lib/permissoes";
import { getSupabaseServerClient } from "@/lib/supabase";
import { sanitizarMensagemErro } from "@/lib/sanitizar-erro";

type Cliente = NonNullable<ReturnType<typeof getSupabaseServerClient>>;

export type NivelSaude = "saudavel" | "atencao" | "critico";
export type ClassificacaoOps = "REUTILIZAR" | "EVOLUIR" | "CRIAR";

export const AUDITORIA_NORYOS_OPS: { item: string; classificacao: ClassificacaoOps; fonte: string }[] = [
  { item: "Clínicas", classificacao: "REUTILIZAR", fonte: "clinicas" },
  { item: "Canais e diagnóstico", classificacao: "REUTILIZAR", fonte: "canais + verificarSaudeCanal" },
  { item: "Alertas técnicos", classificacao: "REUTILIZAR", fonte: "alertas natureza=tecnico / alertas.tecnicos" },
  { item: "Auditoria", classificacao: "REUTILIZAR", fonte: "auditoria_eventos" },
  { item: "Eventos internos", classificacao: "REUTILIZAR", fonte: "automacao_eventos" },
  { item: "Integrações", classificacao: "EVOLUIR", fonte: "integration_sync_state/log + env pública de disponibilidade" },
  { item: "Workers", classificacao: "CRIAR", fonte: "ops_worker_heartbeats + fallback de crons conhecidos" },
  { item: "Erros técnicos", classificacao: "CRIAR", fonte: "ops_erros" },
  { item: "Incidentes", classificacao: "CRIAR", fonte: "ops_incidentes" },
  { item: "Deploys", classificacao: "CRIAR", fonte: "ops_deploys / env Railway quando existir" },
];

export function podeAcessarOps(sessao: SessaoAtual | null, permissao: Permissao = "ops.visualizar"): boolean {
  return Boolean(sessao && PERFIS_PLATAFORMA.has(sessao.perfil) && can(sessao, permissao));
}

export function estadoPorProblemas(input: { criticos?: number; atencao?: number; falhas?: number }): NivelSaude {
  if ((input.criticos ?? 0) > 0 || (input.falhas ?? 0) > 0) return "critico";
  if ((input.atencao ?? 0) > 0) return "atencao";
  return "saudavel";
}

export function mensagemSegura(mensagem: unknown): string {
  return sanitizarMensagemErro(mensagem, 500);
}

export type OpsResumo = {
  saude: NivelSaude;
  clinicasAtivas: number;
  canaisConectados: number;
  canaisComProblema: number;
  integracoesComErro: number;
  workersSaudaveis: number;
  workersComFalha: number;
  alertasTecnicosCriticos: number;
  incidentesAbertos: number;
  errosAbertos: number;
  ultimoDeploy: OpsDeploy | null;
};

export type OpsClinica = {
  id: string;
  nome: string;
  slug: string;
  status: string;
  modulosAtivos: string[];
  canais: number;
  canaisComProblema: number;
  integracoes: number;
  ultimoUsoEm: string | null;
  alertasTecnicos: number;
  incidentesAbertos: number;
  saude: NivelSaude;
};

export type OpsCanal = {
  id: string;
  clinicaId: string;
  clinicaNome: string;
  nome: string;
  provider: string;
  status: string;
  telefone: string | null;
  lastWebhookAt: string | null;
  lastMessageInAt: string | null;
  lastMessageOutAt: string | null;
  lastError: string | null;
  diagnostico: NivelSaude;
};

export type OpsIntegracao = {
  provider: string;
  clinicaId: string | null;
  clinicaNome: string | null;
  status: NivelSaude | "nao_configurada";
  ultimoSucessoEm: string | null;
  ultimoErroEm: string | null;
  detalhe: string | null;
};

export type OpsWorker = {
  nome: string;
  status: NivelSaude;
  ultimoHeartbeatEm: string | null;
  ultimaExecucaoEm: string | null;
  ultimaFalhaEm: string | null;
  filaPendente: number | null;
};

export type OpsErro = {
  id: string;
  data: string;
  servico: string;
  clinicaNome: string | null;
  categoria: string;
  severidade: string;
  mensagemSegura: string;
  correlationId: string | null;
  status: string;
};

export type OpsIncidente = {
  id: string;
  titulo: string;
  severidade: string;
  status: string;
  clinicaNome: string | null;
  origem: string | null;
  responsavelNome: string | null;
  criadoEm: string;
  resolvidoEm: string | null;
  causa: string | null;
  solucao: string | null;
};

export type OpsDeploy = {
  id: string;
  ambiente: string;
  data: string;
  commitSha: string | null;
  status: string;
  deploymentId: string | null;
  origem: string | null;
  responsavel: string | null;
};

export type OpsAuditoria = {
  id: string;
  data: string;
  usuario: string | null;
  perfil: string | null;
  clinicaNome: string | null;
  acao: string;
  alvoId: string | null;
};

function nomeEmbutido(v: unknown): string | null {
  const o = Array.isArray(v) ? v[0] : v;
  return (o as { nome?: string } | null | undefined)?.nome ?? null;
}

async function nomesClinicas(supabase: Cliente, ids: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return new Map();
  const { data } = await supabase.from("clinicas").select("id, nome").in("id", unicos);
  return new Map((data ?? []).map((c) => [c.id as string, c.nome as string]));
}

async function nomesAtendentes(supabase: Cliente, ids: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!unicos.length) return new Map();
  const { data } = await supabase.from("atendentes").select("id, nome").in("id", unicos);
  return new Map((data ?? []).map((a) => [a.id as string, a.nome as string]));
}

export async function listarClinicasOps(): Promise<OpsClinica[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];
  const [clinicas, canais, alertas, incidentes, mensagens, integracoes] = await Promise.all([
    supabase.from("clinicas").select("id, nome, slug, created_at").order("nome"),
    supabase.from("canais").select("id, clinica_id, status, ativo"),
    supabase.from("alertas").select("id, clinica_id, severidade").eq("natureza", "tecnico").in("status", ["aberto", "assumido"]),
    supabase.from("ops_incidentes").select("id, clinica_id").in("status", ["aberto", "investigando"]),
    supabase.from("mensagens").select("clinica_id, created_at").order("created_at", { ascending: false }).limit(300),
    supabase.from("integration_sync_state").select("clinica_id, provider, health"),
  ]);
  const canalRows = (canais.data ?? []) as Record<string, unknown>[];
  const alertaRows = (alertas.data ?? []) as Record<string, unknown>[];
  const incidenteRows = (incidentes.data ?? []) as Record<string, unknown>[];
  const mensagemRows = (mensagens.data ?? []) as Record<string, unknown>[];
  const integracaoRows = (integracoes.data ?? []) as Record<string, unknown>[];

  return ((clinicas.data ?? []) as Record<string, unknown>[]).map((c) => {
    const id = c.id as string;
    const canaisDaClinica = canalRows.filter((x) => x.clinica_id === id);
    const canaisComProblema = canaisDaClinica.filter((x) => x.ativo !== true || ["disconnected", "error"].includes(String(x.status))).length;
    const alertasTecnicos = alertaRows.filter((x) => x.clinica_id === id).length;
    const incidentesAbertos = incidenteRows.filter((x) => x.clinica_id === id).length;
    const ultimoUsoEm = (mensagemRows.find((m) => m.clinica_id === id)?.created_at as string | undefined) ?? null;
    const integracoesDaClinica = integracaoRows.filter((x) => x.clinica_id === id);
    const modulosAtivos = [
      canaisDaClinica.length ? "Canais" : null,
      integracoesDaClinica.length ? "Integrações" : null,
      "Alertas",
      "Fluxos",
      "Kanban",
      "SLA",
    ].filter((x): x is string => Boolean(x));
    return {
      id,
      nome: c.nome as string,
      slug: c.slug as string,
      status: "ativa",
      modulosAtivos,
      canais: canaisDaClinica.length,
      canaisComProblema,
      integracoes: integracoesDaClinica.length,
      ultimoUsoEm,
      alertasTecnicos,
      incidentesAbertos,
      saude: estadoPorProblemas({ criticos: incidentesAbertos, atencao: canaisComProblema + alertasTecnicos }),
    };
  });
}

export async function listarCanaisOps(): Promise<OpsCanal[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("canais")
    .select("id, clinica_id, nome, provider, status, telefone, last_webhook_at, last_message_in_at, last_message_out_at, last_error, ativo, clinicas(nome)")
    .order("updated_at", { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map((c) => {
    const problema = c.ativo !== true || ["disconnected", "error"].includes(String(c.status)) || Boolean(c.last_error);
    return {
      id: c.id as string,
      clinicaId: c.clinica_id as string,
      clinicaNome: nomeEmbutido(c.clinicas) ?? "Clínica",
      nome: c.nome as string,
      provider: c.provider as string,
      status: c.status as string,
      telefone: (c.telefone as string | null) ?? null,
      lastWebhookAt: (c.last_webhook_at as string | null) ?? null,
      lastMessageInAt: (c.last_message_in_at as string | null) ?? null,
      lastMessageOutAt: (c.last_message_out_at as string | null) ?? null,
      lastError: c.last_error ? mensagemSegura(c.last_error) : null,
      diagnostico: problema ? "atencao" : "saudavel",
    };
  });
}

export async function listarIntegracoesOps(): Promise<OpsIntegracao[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];
  const [states, logs, canais, clinicas] = await Promise.all([
    supabase.from("integration_sync_state").select("clinica_id, provider, resource, health, last_success_at, last_error_at, last_error_code, consecutive_failures").limit(200),
    supabase.from("integration_sync_log").select("clinica_id, provider, status, started_at, error_message_sanitized").order("started_at", { ascending: false }).limit(80),
    supabase.from("canais").select("clinica_id, provider, status, last_error").limit(100),
    supabase.from("clinicas").select("id, nome").limit(100),
  ]);
  const nomes = new Map(((clinicas.data ?? []) as Record<string, unknown>[]).map((c) => [c.id as string, c.nome as string]));
  const itens: OpsIntegracao[] = [];
  for (const s of (states.data ?? []) as Record<string, unknown>[]) {
    const health = String(s.health);
    itens.push({
      provider: `${s.provider}/${s.resource}`,
      clinicaId: (s.clinica_id as string | null) ?? null,
      clinicaNome: s.clinica_id ? nomes.get(s.clinica_id as string) ?? null : null,
      status: health === "saudavel" ? "saudavel" : health === "nao_configurada" ? "nao_configurada" : health === "indisponivel" ? "critico" : "atencao",
      ultimoSucessoEm: (s.last_success_at as string | null) ?? null,
      ultimoErroEm: (s.last_error_at as string | null) ?? null,
      detalhe: s.last_error_code ? mensagemSegura(s.last_error_code) : null,
    });
  }
  const porProviderCanal = new Map<string, Record<string, unknown>[]>();
  for (const c of (canais.data ?? []) as Record<string, unknown>[]) {
    const k = `${c.provider}:${c.clinica_id}`;
    porProviderCanal.set(k, [...(porProviderCanal.get(k) ?? []), c]);
  }
  for (const [k, rows] of porProviderCanal) {
    const [provider, clinicaId] = k.split(":");
    const erro = rows.find((r) => ["error", "disconnected"].includes(String(r.status)) || r.last_error);
    itens.push({
      provider,
      clinicaId,
      clinicaNome: nomes.get(clinicaId) ?? null,
      status: erro ? "atencao" : "saudavel",
      ultimoSucessoEm: null,
      ultimoErroEm: erro ? new Date().toISOString() : null,
      detalhe: erro?.last_error ? mensagemSegura(erro.last_error) : null,
    });
  }
  if (!itens.some((i) => i.provider.startsWith("resend"))) {
    itens.push({ provider: "resend", clinicaId: null, clinicaNome: null, status: process.env.RESEND_API_KEY ? "saudavel" : "nao_configurada", ultimoSucessoEm: null, ultimoErroEm: null, detalhe: null });
  }
  if (!itens.some((i) => i.provider.startsWith("supabase"))) {
    itens.push({ provider: "supabase", clinicaId: null, clinicaNome: null, status: getSupabaseServerClient() ? "saudavel" : "critico", ultimoSucessoEm: null, ultimoErroEm: null, detalhe: null });
  }
  for (const l of (logs.data ?? []) as Record<string, unknown>[]) {
    if (l.status !== "erro") continue;
    const item = itens.find((i) => i.provider.startsWith(String(l.provider)) && i.clinicaId === l.clinica_id);
    if (item && !item.ultimoErroEm) {
      item.ultimoErroEm = l.started_at as string;
      item.detalhe = l.error_message_sanitized ? mensagemSegura(l.error_message_sanitized) : item.detalhe;
      if (item.status === "saudavel") item.status = "atencao";
    }
  }
  return itens.sort((a, b) => a.provider.localeCompare(b.provider));
}

export async function listarWorkersOps(): Promise<OpsWorker[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("ops_worker_heartbeats").select("*").order("nome");
  const rows: OpsWorker[] = ((data ?? []) as Record<string, unknown>[]).map((w) => {
    const status: NivelSaude = w.status === "falha" ? "critico" : w.status === "atencao" ? "atencao" : "saudavel";
    return {
      nome: w.nome as string,
      status,
      ultimoHeartbeatEm: (w.ultimo_heartbeat_em as string | null) ?? null,
      ultimaExecucaoEm: (w.ultima_execucao_em as string | null) ?? null,
      ultimaFalhaEm: (w.ultima_falha_em as string | null) ?? null,
      filaPendente: (w.fila_pendente as number | null) ?? null,
    };
  });
  const conhecidos = ["agentes-buffer", "disparos-worker", "fluxo-worker", "cron/alertas", "cron/fluxo-temporal", "cron/controle-odonto-sync"];
  const existentes = new Set(rows.map((w) => w.nome));
  return [...rows, ...conhecidos.filter((nome) => !existentes.has(nome)).map((nome) => ({ nome, status: "atencao" as NivelSaude, ultimoHeartbeatEm: null, ultimaExecucaoEm: null, ultimaFalhaEm: null, filaPendente: null }))];
}

export async function listarErrosOps(limite = 80): Promise<OpsErro[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("ops_erros").select("*").order("ultimo_em", { ascending: false }).limit(limite);
  const rows = (data ?? []) as Record<string, unknown>[];
  const nomes = await nomesClinicas(supabase, rows.map((r) => r.clinica_id as string));
  return rows.map((e) => ({
    id: e.id as string,
    data: e.ultimo_em as string,
    servico: e.servico as string,
    clinicaNome: e.clinica_id ? nomes.get(e.clinica_id as string) ?? null : null,
    categoria: e.categoria as string,
    severidade: e.severidade as string,
    mensagemSegura: mensagemSegura(e.mensagem_segura),
    correlationId: (e.correlation_id as string | null) ?? null,
    status: e.status as string,
  }));
}

export async function listarIncidentesOps(limite = 80): Promise<OpsIncidente[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("ops_incidentes").select("*").order("created_at", { ascending: false }).limit(limite);
  const rows = (data ?? []) as Record<string, unknown>[];
  const [clinicas, atendentes] = await Promise.all([
    nomesClinicas(supabase, rows.map((r) => r.clinica_id as string)),
    nomesAtendentes(supabase, rows.map((r) => r.responsavel_id as string)),
  ]);
  return rows.map((i) => ({
    id: i.id as string,
    titulo: i.titulo as string,
    severidade: i.severidade as string,
    status: i.status as string,
    clinicaNome: i.clinica_id ? clinicas.get(i.clinica_id as string) ?? null : null,
    origem: (i.origem as string | null) ?? null,
    responsavelNome: i.responsavel_id ? atendentes.get(i.responsavel_id as string) ?? null : null,
    criadoEm: i.created_at as string,
    resolvidoEm: (i.resolvido_em as string | null) ?? null,
    causa: (i.causa as string | null) ?? null,
    solucao: (i.solucao as string | null) ?? null,
  }));
}

export async function listarDeploysOps(limite = 30): Promise<OpsDeploy[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("ops_deploys").select("*").order("deployed_at", { ascending: false }).limit(limite);
  const deploys = ((data ?? []) as Record<string, unknown>[]).map((d) => ({
    id: d.id as string,
    ambiente: d.ambiente as string,
    data: d.deployed_at as string,
    commitSha: (d.commit_sha as string | null) ?? null,
    status: d.status as string,
    deploymentId: (d.deployment_id as string | null) ?? null,
    origem: (d.origem as string | null) ?? null,
    responsavel: (d.responsavel as string | null) ?? null,
  }));
  if (deploys.length) return deploys;
  const railwayId = process.env.RAILWAY_DEPLOYMENT_ID || process.env.RAILWAY_DEPLOYMENT;
  const sha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA;
  return railwayId || sha
    ? [{ id: "runtime", ambiente: process.env.NODE_ENV === "production" ? "producao" : "local", data: new Date().toISOString(), commitSha: sha ?? null, status: "desconhecido", deploymentId: railwayId ?? null, origem: "runtime", responsavel: null }]
    : [];
}

export async function listarAuditoriaOps(limite = 80): Promise<OpsAuditoria[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("auditoria_eventos").select("*").order("created_at", { ascending: false }).limit(limite);
  const rows = (data ?? []) as Record<string, unknown>[];
  const [clinicas, atores] = await Promise.all([
    nomesClinicas(supabase, rows.map((r) => r.clinica_id as string)),
    nomesAtendentes(supabase, rows.map((r) => r.ator_id as string)),
  ]);
  return rows.map((a) => ({
    id: a.id as string,
    data: a.created_at as string,
    usuario: a.ator_id ? atores.get(a.ator_id as string) ?? null : null,
    perfil: (a.ator_perfil as string | null) ?? null,
    clinicaNome: a.clinica_id ? clinicas.get(a.clinica_id as string) ?? null : null,
    acao: a.evento as string,
    alvoId: (a.alvo_id as string | null) ?? null,
  }));
}

export async function saudePlataforma(): Promise<OpsResumo> {
  const [clinicas, canais, integracoes, workers, erros, incidentes, deploys] = await Promise.all([
    listarClinicasOps(),
    listarCanaisOps(),
    listarIntegracoesOps(),
    listarWorkersOps(),
    listarErrosOps(20),
    listarIncidentesOps(20),
    listarDeploysOps(1),
  ]);
  const canaisComProblema = canais.filter((c) => c.diagnostico !== "saudavel").length;
  const integracoesComErro = integracoes.filter((i) => i.status === "critico" || i.status === "atencao").length;
  const workersComFalha = workers.filter((w) => w.status === "critico").length;
  const alertasTecnicosCriticos = clinicas.reduce((acc, c) => acc + c.alertasTecnicos, 0);
  const incidentesAbertos = incidentes.filter((i) => i.status !== "resolvido").length;
  const errosAbertos = erros.filter((e) => e.status !== "resolvido").length;
  return {
    saude: estadoPorProblemas({ criticos: incidentesAbertos + workersComFalha, atencao: canaisComProblema + integracoesComErro + alertasTecnicosCriticos + errosAbertos }),
    clinicasAtivas: clinicas.length,
    canaisConectados: canais.filter((c) => c.status === "connected").length,
    canaisComProblema,
    integracoesComErro,
    workersSaudaveis: workers.filter((w) => w.status === "saudavel").length,
    workersComFalha,
    alertasTecnicosCriticos,
    incidentesAbertos,
    errosAbertos,
    ultimoDeploy: deploys[0] ?? null,
  };
}

export async function saudeClinica(clinicaId: string): Promise<OpsClinica | null> {
  const clinicas = await listarClinicasOps();
  return clinicas.find((c) => c.id === clinicaId) ?? null;
}

export type CriarIncidenteInput = {
  titulo: string;
  descricao?: string | null;
  severidade?: "baixa" | "media" | "alta" | "critica";
  clinicaId?: string | null;
  origem?: string | null;
  erroId?: string | null;
  alertaId?: string | null;
  correlationId?: string | null;
};

export async function criarIncidenteOps(input: CriarIncidenteInput, sessao: SessaoAtual): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const titulo = input.titulo.trim();
  if (!titulo) return { ok: false, error: "titulo_obrigatorio" };
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };
  const { data, error } = await supabase
    .from("ops_incidentes")
    .insert({
      titulo,
      descricao: input.descricao?.trim() || null,
      severidade: input.severidade ?? "media",
      clinica_id: input.clinicaId ?? null,
      origem: input.origem ?? (input.erroId ? "erro" : input.alertaId ? "alerta" : "manual"),
      erro_id: input.erroId ?? null,
      alerta_id: input.alertaId ?? null,
      correlation_id: input.correlationId ?? null,
      criado_por: sessao.atendenteId,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "persist_failed" };
  if (input.erroId) await supabase.from("ops_erros").update({ status: "associado", updated_at: new Date().toISOString() }).eq("id", input.erroId);
  return { ok: true, id: data.id as string };
}

export async function atualizarIncidenteOps(
  id: string,
  input: { status?: "aberto" | "investigando" | "resolvido"; causa?: string | null; solucao?: string | null },
  sessao: SessaoAtual
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.status) patch.status = input.status;
  if (input.causa !== undefined) patch.causa = input.causa?.trim() || null;
  if (input.solucao !== undefined) patch.solucao = input.solucao?.trim() || null;
  if (input.status === "resolvido") {
    patch.resolvido_em = new Date().toISOString();
    patch.resolvido_por = sessao.atendenteId;
  }
  const { error } = await supabase.from("ops_incidentes").update(patch).eq("id", id);
  return error ? { ok: false, error: "persist_failed" } : { ok: true };
}
