import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Etiquetas (tags) livres do Chat ao Vivo — infraestrutura pedida pelo
 * Rafael mesmo sem um catálogo fixo pra odontologia ainda ("não se prenda
 * pelas etiquetas de outro nicho, mas já prepara o sistema pra ter"). Cada
 * clínica cria as suas; sem seed nenhum aqui de propósito.
 */

export type Etiqueta = { id: string; nome: string; cor: string };

// Paleta fixa (não é a cor da marca — é só pra distinguir etiquetas visualmente
// na lista/filtro), ciclada por ordem de criação.
const PALETA_CORES = [
  "#0d9488", // teal
  "#2563eb", // azul
  "#d97706", // âmbar
  "#7c3aed", // violeta
  "#db2777", // rosa
  "#059669", // esmeralda
  "#dc2626", // vermelho
  "#4b5563", // cinza
];

export async function listarEtiquetas(clinicaId: string): Promise<Etiqueta[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("etiquetas")
    .select("id, nome, cor")
    .eq("clinica_id", clinicaId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    if (error) console.error("[etiquetas] listar_failed", JSON.stringify({ code: error.code ?? null }));
    return [];
  }

  return data.map((r) => ({ id: r.id as string, nome: r.nome as string, cor: r.cor as string }));
}

export async function criarEtiqueta(
  clinicaId: string,
  nomeBruto: string
): Promise<{ ok: boolean; etiqueta?: Etiqueta; error?: string }> {
  const nome = nomeBruto.trim();
  if (!nome) return { ok: false, error: "nome_vazio" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { count } = await supabase
    .from("etiquetas")
    .select("id", { count: "exact", head: true })
    .eq("clinica_id", clinicaId);
  const cor = PALETA_CORES[(count ?? 0) % PALETA_CORES.length];

  const { data, error } = await supabase
    .from("etiquetas")
    .insert({ clinica_id: clinicaId, nome, cor })
    .select("id, nome, cor")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "ja_existe" };
    console.error("[etiquetas] criar_failed", JSON.stringify({ code: error?.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  return { ok: true, etiqueta: { id: data.id as string, nome: data.nome as string, cor: data.cor as string } };
}

export async function adicionarEtiquetaConversa(
  clinicaId: string,
  conversaId: string,
  etiquetaId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const [{ data: conversa }, { data: etiqueta }] = await Promise.all([
    supabase.from("conversas").select("id").eq("id", conversaId).eq("clinica_id", clinicaId).maybeSingle(),
    supabase.from("etiquetas").select("id").eq("id", etiquetaId).eq("clinica_id", clinicaId).maybeSingle(),
  ]);
  if (!conversa || !etiqueta) return { ok: false, error: "not_found" };

  const { error } = await supabase
    .from("conversa_etiquetas")
    .insert({ conversa_id: conversaId, etiqueta_id: etiquetaId });

  // já estava marcada: idempotente, não é erro.
  if (error && error.code !== "23505") {
    console.error("[etiquetas] adicionar_failed", JSON.stringify({ code: error.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  return { ok: true };
}

export async function removerEtiquetaConversa(
  conversaId: string,
  etiquetaId: string
): Promise<{ ok: boolean }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false };

  await supabase
    .from("conversa_etiquetas")
    .delete()
    .eq("conversa_id", conversaId)
    .eq("etiqueta_id", etiquetaId);

  return { ok: true };
}
