import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Aba "Conhecimento" dos Agentes de IA (print do "Agente 01" da RoiZap) — a
 * única das 4 abas novas do print que o Rafael decidiu construir de verdade
 * agora (Qualificação/Ferramentas/Pixel ficaram de fora). Fatos curtos
 * (título + conteúdo) por agente, entram no prompt final via
 * `montarPromptSistema` (src/lib/agentes.ts). Mesmo formato de
 * `etiquetas.ts`: sem `update`, edita apagando e recriando.
 */

export type ConhecimentoItem = { id: string; titulo: string; conteudo: string };

export async function listarConhecimento(clinicaId: string, agenteId: string): Promise<ConhecimentoItem[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("agentes_conhecimento")
    .select("id, titulo, conteudo")
    .eq("clinica_id", clinicaId)
    .eq("agente_id", agenteId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    if (error) console.error("[agentes-conhecimento] listar_failed", JSON.stringify({ code: error.code ?? null }));
    return [];
  }

  return data.map((r) => ({ id: r.id as string, titulo: r.titulo as string, conteudo: r.conteudo as string }));
}

export async function contarConhecimento(clinicaId: string, agenteId: string): Promise<number> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return 0;

  const { count } = await supabase
    .from("agentes_conhecimento")
    .select("id", { count: "exact", head: true })
    .eq("clinica_id", clinicaId)
    .eq("agente_id", agenteId);

  return count ?? 0;
}

export async function criarConhecimento(
  clinicaId: string,
  agenteId: string,
  tituloBruto: string,
  conteudoBruto: string
): Promise<{ ok: boolean; item?: ConhecimentoItem; error?: string }> {
  const titulo = tituloBruto.trim();
  const conteudo = conteudoBruto.trim();
  if (!titulo || !conteudo) return { ok: false, error: "titulo_ou_conteudo_vazio" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data, error } = await supabase
    .from("agentes_conhecimento")
    .insert({ clinica_id: clinicaId, agente_id: agenteId, titulo, conteudo })
    .select("id, titulo, conteudo")
    .single();

  if (error || !data) {
    console.error("[agentes-conhecimento] criar_failed", JSON.stringify({ code: error?.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  return { ok: true, item: { id: data.id as string, titulo: data.titulo as string, conteudo: data.conteudo as string } };
}

export async function excluirConhecimento(clinicaId: string, id: string): Promise<{ ok: boolean }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false };

  await supabase.from("agentes_conhecimento").delete().eq("id", id).eq("clinica_id", clinicaId);
  return { ok: true };
}
