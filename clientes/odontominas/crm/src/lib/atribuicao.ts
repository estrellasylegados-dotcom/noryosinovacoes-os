import { getSupabaseServerClient } from "@/lib/supabase";
import { buscarAtendenteCompletoPorId } from "@/lib/atendentes";
import { liberarControle } from "@/lib/dono-conversa";
import { registrarEvento } from "@/lib/auditoria";
import { resolverPorEvento } from "@/lib/alertas";
import { sincronizarResponsavelDaConversa } from "@/lib/kanban";
import { PERFIS_PLATAFORMA, resolverPermissoes, type Perfil, type Permissao } from "@/lib/permissoes";

/**
 * Caixa compartilhada: quem é o RESPONSÁVEL por uma conversa e o que cada
 * pessoa pode fazer com ela. Toda mudança de responsável passa pelas funções
 * Postgres `assumir_conversa` / `transferir_conversa` / `desatribuir_conversa`
 * (migration v30): UPDATE condicional + evento na mesma transação, então duas
 * pessoas clicando ao mesmo tempo dão exatamente 1 sucesso e 1 conflito
 * controlado — nunca last-write-wins silencioso, e nunca só no frontend.
 *
 * Ownership de quem RESPONDE (Humano/IA/Fluxo) continua sendo `dono_conversa`
 * (src/lib/dono-conversa.ts). `atribuido_a` = quem é responsável, não quem
 * responde automaticamente. Assumir só encosta em `dono_conversa` quando a IA
 * está no controle (ela para); um Fluxo em `waiting_input` continua capturando
 * a resposta do paciente até o humano de fato responder (chat.ts).
 */

export type AtorConversa = {
  atendenteId: string;
  perfil: Perfil;
  permissoes: ReadonlySet<Permissao>;
};

export type ErroAtribuicao =
  | "forbidden"
  | "not_found"
  | "ja_assumida"
  | "conflito"
  | "destino_invalido"
  | "destino_sem_permissao"
  | "backend_unavailable"
  | "rpc_failed";

export type ResultadoAtribuicao =
  | { ok: true; jaEraSua?: boolean }
  | { ok: false; error: ErroAtribuicao; porId?: string | null; porNome?: string | null };

// ---------------------------------------------------------------------------
// Regras (puras, testáveis)
// ---------------------------------------------------------------------------

export type DecisaoEnvioHumano = "responsavel" | "assumir_e_enviar" | "intervir" | "negado";

/**
 * Quem pode ENVIAR mensagem numa conversa (o gate real fica no backend, o
 * botão escondido é só conveniência):
 *  - responsável → ok;
 *  - sem responsável → assume na mesma operação atômica e envia;
 *  - responsável é outra pessoa → só com `conversas.intervir` (auditado).
 */
export function decidirEnvioHumano(ator: AtorConversa, atribuidoA: string | null): DecisaoEnvioHumano {
  if (!ator.permissoes.has("conversas.assumir")) return "negado";
  if (atribuidoA === ator.atendenteId) return "responsavel";
  if (atribuidoA === null) return "assumir_e_enviar";
  return ator.permissoes.has("conversas.intervir") ? "intervir" : "negado";
}

/** Transferir/devolver à fila: atendente comum só o que é dela; gerência (visualizar_todas ou intervir) qualquer conversa. */
export function podeMexerNoResponsavel(ator: AtorConversa, atribuidoA: string | null): boolean {
  if (!ator.permissoes.has("conversas.transferir")) return false;
  if (atribuidoA === null || atribuidoA === ator.atendenteId) return true;
  return ator.permissoes.has("conversas.visualizar_todas") || ator.permissoes.has("conversas.intervir");
}

export type DestinoTransferencia = {
  clinicaId: string | null;
  status: string;
  perfil: Perfil;
  permissoes: ReadonlySet<Permissao>;
};

/** Destino de transferência: mesma clínica, ativo, perfil operacional (nunca conta de plataforma) e com permissão de assumir. */
export function destinoElegivel(destino: DestinoTransferencia, clinicaId: string): true | "destino_invalido" | "destino_sem_permissao" {
  if (destino.clinicaId !== clinicaId) return "destino_invalido";
  if (destino.status !== "active") return "destino_invalido";
  if (PERFIS_PLATAFORMA.has(destino.perfil)) return "destino_invalido";
  if (!destino.permissoes.has("conversas.assumir")) return "destino_sem_permissao";
  return true;
}

// ---------------------------------------------------------------------------
// Persistência
// ---------------------------------------------------------------------------

type RespostaRpc = { ok: boolean; error?: string; ja_era_sua?: boolean; por_id?: string | null; por_nome?: string | null };

function traduzirRpc(dados: RespostaRpc | null, erroRpc: unknown): ResultadoAtribuicao {
  if (erroRpc || !dados) return { ok: false, error: "rpc_failed" };
  if (dados.ok) return { ok: true, jaEraSua: dados.ja_era_sua === true };
  return { ok: false, error: (dados.error as ErroAtribuicao) ?? "rpc_failed", porId: dados.por_id ?? null, porNome: dados.por_nome ?? null };
}

async function lerCanalEDono(clinicaId: string, conversaId: string) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("conversas")
    .select("canal_id, dono_conversa")
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  return data ? { canalId: (data.canal_id as string | null) ?? null, dono: (data.dono_conversa as string | null) ?? "humano" } : null;
}

export async function assumirConversa(clinicaId: string, conversaId: string, ator: AtorConversa): Promise<ResultadoAtribuicao> {
  if (!ator.permissoes.has("conversas.assumir")) return { ok: false, error: "forbidden" };
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data, error } = await supabase.rpc("assumir_conversa", { p_clinica: clinicaId, p_conversa: conversaId, p_ator: ator.atendenteId });
  const resultado = traduzirRpc(data as RespostaRpc | null, error);

  if (resultado.ok && !resultado.jaEraSua) {
    console.log("[atribuicao] conversation_assigned", JSON.stringify({ conversaId, atorId: ator.atendenteId }));
    // D3: humano assumiu, a IA para (mesma ação do "Pausar IA" do painel). Fluxo não é tocado.
    const estado = await lerCanalEDono(clinicaId, conversaId);
    if (estado?.dono === "agente_ia") {
      await liberarControle(clinicaId, conversaId, { agente_ativo_id: null, agente_pausado_ate: null });
    }
    await registrarEvento({
      clinicaId,
      atorId: ator.atendenteId,
      atorPerfil: ator.perfil,
      evento: "CONVERSATION_ASSIGNED",
      alvoId: conversaId,
      detalhes: { canalId: estado?.canalId ?? null },
    });
    // Kanban: oportunidade sem responsável herda quem assumiu (não troca a que já tem dono).
    await sincronizarResponsavelDaConversa(clinicaId, conversaId, null, ator.atendenteId, ator.atendenteId);
    // Alertas: "sem responsável" deixa de ser verdade na hora (o SLA, se houver, troca de dono no verificador).
    await resolverPorEvento(clinicaId, { tipos: ["conversa_sem_responsavel"], tipoEntidade: "conversa", entidadeId: conversaId, evento: "conversa_assumida", atorId: ator.atendenteId });
  } else if (!resultado.ok && resultado.error === "ja_assumida") {
    console.log("[atribuicao] assign_conflict", JSON.stringify({ conversaId, atorId: ator.atendenteId, porId: resultado.porId ?? null }));
  }
  return resultado;
}

export async function transferirConversa(
  clinicaId: string,
  conversaId: string,
  ator: AtorConversa,
  esperadoAtribuidoA: string | null,
  destinoId: string,
  motivo?: string | null
): Promise<ResultadoAtribuicao> {
  if (!podeMexerNoResponsavel(ator, esperadoAtribuidoA)) return { ok: false, error: "forbidden" };

  const destino = await buscarAtendenteCompletoPorId(destinoId);
  if (!destino) return { ok: false, error: "destino_invalido" };
  const elegivel = destinoElegivel(
    {
      clinicaId: destino.clinicaId,
      status: destino.status,
      perfil: destino.perfil,
      permissoes: resolverPermissoes(destino.perfil, destino.permissoesCustomizadas),
    },
    clinicaId
  );
  if (elegivel !== true) return { ok: false, error: elegivel };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data, error } = await supabase.rpc("transferir_conversa", {
    p_clinica: clinicaId,
    p_conversa: conversaId,
    p_ator: ator.atendenteId,
    p_esperado: esperadoAtribuidoA,
    p_destino: destinoId,
    p_motivo: motivo?.trim().slice(0, 300) || null,
    p_forcar: false,
  });
  const resultado = traduzirRpc(data as RespostaRpc | null, error);

  if (resultado.ok) {
    console.log("[atribuicao] conversation_transfer", JSON.stringify({ conversaId, atorId: ator.atendenteId, destinoId }));
    await registrarEvento({
      clinicaId,
      atorId: ator.atendenteId,
      atorPerfil: ator.perfil,
      evento: esperadoAtribuidoA === null ? "CONVERSATION_ASSIGNED" : "CONVERSATION_TRANSFERRED",
      alvoId: conversaId,
      detalhes: { de: esperadoAtribuidoA, para: destinoId },
    });
    // Kanban: só leva a oportunidade junto se o responsável dela era o anterior da conversa.
    await sincronizarResponsavelDaConversa(clinicaId, conversaId, esperadoAtribuidoA, destinoId, ator.atendenteId);
    await resolverPorEvento(clinicaId, { tipos: ["conversa_sem_responsavel"], tipoEntidade: "conversa", entidadeId: conversaId, evento: "conversa_transferida", atorId: ator.atendenteId });
  } else if (resultado.error === "conflito") {
    console.log("[atribuicao] transfer_conflict", JSON.stringify({ conversaId, atorId: ator.atendenteId, porId: resultado.porId ?? null }));
  }
  return resultado;
}

export async function desatribuirConversa(
  clinicaId: string,
  conversaId: string,
  ator: AtorConversa,
  esperadoAtribuidoA: string | null,
  motivo?: string | null
): Promise<ResultadoAtribuicao> {
  if (esperadoAtribuidoA === null) return { ok: false, error: "conflito" };
  if (!podeMexerNoResponsavel(ator, esperadoAtribuidoA)) return { ok: false, error: "forbidden" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data, error } = await supabase.rpc("desatribuir_conversa", {
    p_clinica: clinicaId,
    p_conversa: conversaId,
    p_ator: ator.atendenteId,
    p_esperado: esperadoAtribuidoA,
    p_motivo: motivo?.trim().slice(0, 300) || null,
  });
  const resultado = traduzirRpc(data as RespostaRpc | null, error);
  if (resultado.ok) {
    await registrarEvento({ clinicaId, atorId: ator.atendenteId, atorPerfil: ator.perfil, evento: "CONVERSATION_UNASSIGNED", alvoId: conversaId });
  }
  return resultado;
}

/** Ação de Fluxo/sistema: atribui sem "visão" prévia (sem checagem de esperado), mas com o mesmo histórico atômico. */
export async function atribuirPorAutomacao(clinicaId: string, conversaId: string, destinoId: string): Promise<{ ok: boolean }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data, error } = await supabase.rpc("transferir_conversa", {
    p_clinica: clinicaId,
    p_conversa: conversaId,
    p_ator: null,
    p_esperado: null,
    p_destino: destinoId,
    p_motivo: "automacao_fluxo",
    p_forcar: true,
  });
  return { ok: !error && (data as RespostaRpc | null)?.ok === true };
}

/** Eventos sem RPC própria (finalizar/reabrir/intervir) — best-effort, nunca derruba a ação principal. */
export async function registrarEventoConversa(
  clinicaId: string,
  conversaId: string,
  tipo: "CONVERSATION_CLOSED" | "CONVERSATION_REOPENED" | "CONVERSATION_INTERVENED",
  atorId: string | null,
  extra: { canalId?: string | null; deAtendenteId?: string | null; motivo?: string | null } = {}
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;
  const { error } = await supabase.from("conversa_eventos").insert({
    clinica_id: clinicaId,
    conversa_id: conversaId,
    canal_id: extra.canalId ?? null,
    tipo,
    ator_id: atorId,
    de_atendente_id: extra.deAtendenteId ?? null,
    motivo: extra.motivo ?? null,
  });
  if (error) console.error("[atribuicao] evento_failed", JSON.stringify({ tipo, code: error.code ?? null }));
}
