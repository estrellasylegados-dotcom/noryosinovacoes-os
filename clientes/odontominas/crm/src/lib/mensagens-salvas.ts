import { getSupabaseServerClient } from "@/lib/supabase";
import { primeiroNome } from "@/lib/reativacao";

/**
 * Biblioteca de mensagens salvas (templates) — Fase A de Disparos. Guarda o
 * texto com as variáveis literais (`{nome}`, `{primeiro_nome}`, `{telefone}`);
 * a substituição só acontece na hora de montar o envio (`resolverVariaveis`),
 * nunca é gravada já resolvida.
 */

export type MensagemSalva = {
  id: string;
  nome: string;
  conteudo: string;
  criadoPor: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listarMensagensSalvas(clinicaId: string): Promise<MensagemSalva[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("mensagens_salvas")
    .select("id, nome, conteudo, criado_por, created_at, updated_at")
    .eq("clinica_id", clinicaId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((m) => ({
    id: m.id as string,
    nome: m.nome as string,
    conteudo: m.conteudo as string,
    criadoPor: (m.criado_por as string | null) ?? null,
    createdAt: m.created_at as string,
    updatedAt: m.updated_at as string,
  }));
}

export type ResultadoMensagemSalva = { ok: boolean; id?: string; error?: string };

export async function criarMensagemSalva(
  clinicaId: string,
  nome: string,
  conteudo: string,
  criadoPor: string | null
): Promise<ResultadoMensagemSalva> {
  const nomeLimpo = nome.trim();
  const conteudoLimpo = conteudo.trim();
  if (!nomeLimpo || !conteudoLimpo) return { ok: false, error: "campos_obrigatorios" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data, error } = await supabase
    .from("mensagens_salvas")
    .insert({ clinica_id: clinicaId, nome: nomeLimpo, conteudo: conteudoLimpo, criado_por: criadoPor })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[mensagens-salvas] criar_failed", JSON.stringify({ code: error?.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }
  return { ok: true, id: data.id as string };
}

export async function atualizarMensagemSalva(
  clinicaId: string,
  id: string,
  dados: { nome?: string; conteudo?: string }
): Promise<ResultadoMensagemSalva> {
  const patch: Record<string, string> = { updated_at: new Date().toISOString() };
  if (dados.nome !== undefined) {
    const nomeLimpo = dados.nome.trim();
    if (!nomeLimpo) return { ok: false, error: "campos_obrigatorios" };
    patch.nome = nomeLimpo;
  }
  if (dados.conteudo !== undefined) {
    const conteudoLimpo = dados.conteudo.trim();
    if (!conteudoLimpo) return { ok: false, error: "campos_obrigatorios" };
    patch.conteudo = conteudoLimpo;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { error } = await supabase.from("mensagens_salvas").update(patch).eq("id", id).eq("clinica_id", clinicaId);
  if (error) {
    console.error("[mensagens-salvas] atualizar_failed", JSON.stringify({ id, code: error.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }
  return { ok: true, id };
}

export async function excluirMensagemSalva(clinicaId: string, id: string): Promise<ResultadoMensagemSalva> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { error } = await supabase.from("mensagens_salvas").delete().eq("id", id).eq("clinica_id", clinicaId);
  if (error) {
    console.error("[mensagens-salvas] excluir_failed", JSON.stringify({ id, code: error.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }
  return { ok: true, id };
}

export type DadosVariaveis = { nome?: string | null; telefone?: string | null };

const FALLBACK_SEM_NOME = "";

/**
 * Nunca deixa `{nome}`/`{primeiro_nome}` virar "undefined" quando o paciente
 * não tem nome cadastrado: substitui por vazio e limpa a pontuação órfã que
 * sobra (", !" → "!", " ," → ","), pra funcionar com o template escrito do
 * jeito que a recepção quiser ("Oi {primeiro_nome}, tudo bem?", "Oi, {nome}!"...).
 */
export function resolverVariaveis(texto: string, dados: DadosVariaveis): string {
  const nome = dados.nome?.trim() || null;
  const substituicoes: Record<string, string> = {
    "{nome}": nome ?? FALLBACK_SEM_NOME,
    "{primeiro_nome}": nome ? primeiroNome(nome) : FALLBACK_SEM_NOME,
    "{telefone}": dados.telefone?.trim() ?? "",
  };

  const resolvido = Object.entries(substituicoes).reduce(
    (acc, [chave, valor]) => acc.split(chave).join(valor),
    texto
  );

  return limparPontuacaoOrfa(resolvido);
}

function limparPontuacaoOrfa(texto: string): string {
  return texto
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.!?])/g, "$1")
    .replace(/,\s*([,.!?])/g, "$1")
    .trim();
}
