/** Validação controlada em produção. Usa somente o paciente autorizado Rafael (teste Disparos). */
import { readFileSync } from "node:fs";

for (const linha of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  if (!linha || linha.startsWith("#") || !linha.includes("=")) continue;
  const i = linha.indexOf("=");
  const chave = linha.slice(0, i).trim();
  if (!(chave in process.env)) process.env[chave] = linha.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}
process.env.AUTOMACOES_KANBAN_ENABLED = "true";

const { getSupabaseServerClient } = await import("@/lib/supabase");
const { getClinicaId } = await import("@/lib/clinica");
const { atualizarStatusFluxo } = await import("@/lib/fluxo-versoes");
const { processarEventoComercial } = await import("@/lib/fluxo-comercial");
const { processarProximoPassoDevido } = await import("@/lib/fluxo-execucoes");
const K = await import("@/lib/kanban");
const { PERFIS_PADRAO } = await import("@/lib/permissoes");

const db = getSupabaseServerClient()!;
const clinicaId = (await getClinicaId())!;
const fluxoId = "ba51dbe3-93c1-4ead-aa8c-0ef3b823407b";
const log = (etapa: string, dados: unknown) => console.log(JSON.stringify({ etapa, dados }));
const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const { data: admin } = await db.from("atendentes").select("id").eq("clinica_id", clinicaId).eq("nome", "[TESTE] Noryos Admin").single();
if (!admin) throw new Error("conta_admin_teste_nao_encontrada");
const ator = { atendenteId: admin!.id as string, perfil: "noryos_admin" as const, permissoes: PERFIS_PADRAO.noryos_admin };
const { data: paciente } = await db.from("pacientes").select("id,nome,telefone").eq("clinica_id", clinicaId).eq("nome", "Rafael (teste Disparos)").single();
if (!paciente || paciente.telefone !== "5561981925241") throw new Error("paciente_teste_nao_autorizado");
const { data: oportunidade } = await db.from("oportunidades").select("id,versao,estagio_id,status,conversa_id").eq("clinica_id", clinicaId).eq("paciente_id", paciente.id).eq("status", "open").single();
if (!oportunidade?.conversa_id) throw new Error("oportunidade_teste_sem_conversa");
const { data: etapas } = await db.from("pipeline_estagios").select("id,nome").eq("clinica_id", clinicaId).eq("ativo", true);
const etapa = (nome: string) => etapas!.find((e) => e.nome === nome)!.id as string;

const ativacao = await atualizarStatusFluxo(clinicaId, fluxoId, "ativo", ator.atendenteId);
log("ativacao", ativacao);
if (!ativacao.ok) throw new Error(`ativacao:${ativacao.error}`);
try {
  let { data: execucao } = await db.from("fluxo_execucoes").select("id,estado,created_at,gatilho_dedupe_key").eq("clinica_id", clinicaId).eq("fluxo_id", fluxoId).eq("oportunidade_id", oportunidade.id).in("estado", ["queued", "running", "waiting_time", "waiting_input"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!execucao) {
    let atual = oportunidade;
    if (atual.estagio_id === etapa("Follow-up")) {
      const saida = await K.moverOportunidade(clinicaId, ator, atual.id as string, { estagioId: etapa("Agendado"), versaoEsperada: atual.versao as number });
      if (!saida.ok) throw new Error(`preparacao:${saida.error}`);
      atual = { ...atual, estagio_id: saida.estagioId, versao: saida.versao };
    }
    const entrada = await K.moverOportunidade(clinicaId, ator, atual.id as string, { estagioId: etapa("Follow-up"), versaoEsperada: atual.versao as number });
    log("movimento_follow_up", entrada);
    if (!entrada.ok) throw new Error(`movimento:${entrada.error}`);
    for (let i = 0; i < 10 && await processarEventoComercial(clinicaId); i++);
    ({ data: execucao } = await db.from("fluxo_execucoes").select("id,estado,created_at,gatilho_dedupe_key").eq("clinica_id", clinicaId).eq("fluxo_id", fluxoId).eq("oportunidade_id", oportunidade.id).order("created_at", { ascending: false }).limit(1).single());
  }
  if (!execucao) throw new Error("execucao_nao_criada");
  log("execucao", execucao);
  const { count: duplicadas } = await db.from("fluxo_execucoes").select("id", { count: "exact", head: true }).eq("fluxo_id", fluxoId).eq("gatilho_dedupe_key", execucao.gatilho_dedupe_key);
  if (duplicadas !== 1) throw new Error(`dedupe_falhou:${duplicadas}`);

  let esperando: { estado: string; aguardando_ate: string | null; no_atual_id: string } | null = null;
  for (let i = 0; i < 4; i++) {
    await processarProximoPassoDevido(clinicaId);
    ({ data: esperando } = await db.from("fluxo_execucoes").select("estado,aguardando_ate,no_atual_id").eq("id", execucao.id).single());
    if (esperando?.estado === "waiting_time") break;
  }
  log("espera", esperando);
  if (esperando?.estado !== "waiting_time") throw new Error(`espera_invalida:${esperando?.estado}`);

  const esperaMs = Math.max(0, Date.parse(esperando.aguardando_ate!) - Date.now() + 1000);
  await dormir(esperaMs);
  for (let i = 0; i < 8; i++) {
    const processou = await processarProximoPassoDevido(clinicaId);
    if (!processou) break;
  }
  const { data: final } = await db.from("fluxo_execucoes").select("estado,no_atual_id,aguardando_ate,motivo_finalizacao,erro").eq("id", execucao.id).single();
  const { data: eventos } = await db.from("fluxo_execucao_eventos").select("sequencia,tipo_evento,status,payload,created_at").eq("execucao_id", execucao.id).order("sequencia");
  const { data: mensagens } = await db.from("mensagens").select("id,direcao,conteudo,status_envio,canal_id,created_at").eq("clinica_id", clinicaId).eq("conversa_id", oportunidade.conversa_id).gte("created_at", execucao.created_at).order("created_at");
  log("estado_apos_primeira_acao", final);
  log("eventos", eventos);
  log("mensagens_teste", mensagens);
} finally {
  const pausa = await atualizarStatusFluxo(clinicaId, fluxoId, "pausado", ator.atendenteId, true);
  log("pausa_final", pausa);
}
