import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase";
import { hashSenha } from "@/lib/senha";
import type { Papel } from "@/lib/sessao";

export type Atendente = {
  id: string;
  nome: string;
  usuario: string;
  papel: Papel;
  ativo: boolean;
};

function isPapel(v: string): v is Papel {
  return v === "admin" || v === "atendente";
}

/** Mesma normalização já usada no login (api/login/route.ts) — precisa bater pra não criar conta que nunca loga. */
export function normalizarUsuario(usuario: string): string {
  return usuario.trim().toLowerCase();
}

const USUARIO_REGEX = /^[a-z0-9._-]+$/;

export type DadosNovoAtendente = { nome: string; usuario: string; senha: string; papel: string };

/** Pura, sem I/O — testável direto (mesmo critério de `validarDados` em agentes.ts). */
export function validarDadosNovoAtendente(dados: DadosNovoAtendente): string | null {
  if (!dados.nome.trim()) return "nome_obrigatorio";
  const usuario = normalizarUsuario(dados.usuario);
  if (!usuario) return "usuario_obrigatorio";
  if (!USUARIO_REGEX.test(usuario)) return "usuario_invalido";
  if (dados.senha.length < 8) return "senha_muito_curta";
  if (!isPapel(dados.papel)) return "papel_invalido";
  return null;
}

/** Login: busca conta ativa por usuário. Inclui o hash — só pra uso interno da rota de login. */
export async function buscarAtendentePorUsuario(
  clinicaId: string,
  usuario: string
): Promise<(Atendente & { senhaHash: string }) | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !usuario) return null;

  const { data, error } = await supabase
    .from("atendentes")
    .select("id, nome, usuario, senha_hash, papel, ativo")
    .eq("clinica_id", clinicaId)
    .eq("usuario", usuario)
    .eq("ativo", true)
    .maybeSingle();

  // Sem log quando `data` é null e não há erro: usuário digitado errado é
  // rotina de login, não falha de sistema. Erro de verdade (tabela ausente,
  // Supabase fora do ar) sim, pra dar sinal de operação — sem logar o
  // usuário tentado, só o código do erro.
  if (error) {
    console.error("[atendentes] busca_por_usuario_failed", JSON.stringify({ code: error.code ?? null }));
    return null;
  }
  if (!data) return null;
  const papel = data.papel as string;
  if (!isPapel(papel)) return null;

  return {
    id: data.id as string,
    nome: data.nome as string,
    usuario: data.usuario as string,
    senhaHash: data.senha_hash as string,
    papel,
    ativo: data.ativo as boolean,
  };
}

/** Equipe (admin): lista todo mundo, ativo ou não, pra Equipe mostrar o time completo. */
export async function listarAtendentes(clinicaId: string): Promise<Atendente[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("atendentes")
    .select("id, nome, usuario, papel, ativo")
    .eq("clinica_id", clinicaId)
    .order("nome", { ascending: true });

  if (error || !data) {
    if (error) console.error("[atendentes] listar_failed", JSON.stringify({ code: error.code ?? null }));
    return [];
  }

  return data
    .filter((r) => isPapel(r.papel as string))
    .map((r) => ({
      id: r.id as string,
      nome: r.nome as string,
      usuario: r.usuario as string,
      papel: r.papel as Papel,
      ativo: r.ativo as boolean,
    }));
}

export async function buscarAtendentePorId(clinicaId: string, id: string): Promise<Atendente | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("atendentes")
    .select("id, nome, usuario, papel, ativo")
    .eq("clinica_id", clinicaId)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const papel = data.papel as string;
  if (!isPapel(papel)) return null;

  return {
    id: data.id as string,
    nome: data.nome as string,
    usuario: data.usuario as string,
    papel,
    ativo: data.ativo as boolean,
  };
}

/** Cria conta com senha temporária definida pelo admin — sem convite por e-mail ainda (ver andamento.md). */
export async function criarAtendente(
  clinicaId: string,
  dados: DadosNovoAtendente
): Promise<{ ok: boolean; atendente?: Atendente; error?: string }> {
  const erro = validarDadosNovoAtendente(dados);
  if (erro) return { ok: false, error: erro };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data, error } = await supabase
    .from("atendentes")
    .insert({
      clinica_id: clinicaId,
      nome: dados.nome.trim(),
      usuario: normalizarUsuario(dados.usuario),
      senha_hash: hashSenha(dados.senha),
      papel: dados.papel,
      ativo: true,
    })
    .select("id, nome, usuario, papel, ativo")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "usuario_ja_existe" };
    console.error("[atendentes] criar_failed", JSON.stringify({ code: error?.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  return {
    ok: true,
    atendente: {
      id: data.id as string,
      nome: data.nome as string,
      usuario: data.usuario as string,
      papel: data.papel as Papel,
      ativo: data.ativo as boolean,
    },
  };
}

/**
 * Se esta mudança tiraria o único admin ativo da clínica (desativar ou
 * rebaixar), barra — sem isso a clínica fica sem ninguém que consiga
 * reverter, e só um INSERT manual via SQL/MCP destrava (mesmo problema que
 * o CRUD inteiro existe pra evitar).
 */
async function seriaUltimoAdminAtivo(
  supabase: SupabaseClient,
  clinicaId: string,
  atual: Atendente,
  dados: Partial<{ nome: string; papel: Papel; ativo: boolean }>
): Promise<boolean> {
  const perderiaStatusDeAdminAtivo =
    atual.papel === "admin" &&
    atual.ativo &&
    (dados.ativo === false || (dados.papel !== undefined && dados.papel !== "admin"));
  if (!perderiaStatusDeAdminAtivo) return false;

  const { count } = await supabase
    .from("atendentes")
    .select("id", { count: "exact", head: true })
    .eq("clinica_id", clinicaId)
    .eq("papel", "admin")
    .eq("ativo", true)
    .neq("id", atual.id);

  return (count ?? 0) === 0;
}

export async function atualizarAtendente(
  clinicaId: string,
  id: string,
  dados: Partial<{ nome: string; papel: Papel; ativo: boolean }>
): Promise<{ ok: boolean; atendente?: Atendente; error?: string }> {
  const atual = await buscarAtendentePorId(clinicaId, id);
  if (!atual) return { ok: false, error: "not_found" };

  if (dados.nome !== undefined && !dados.nome.trim()) return { ok: false, error: "nome_obrigatorio" };
  if (dados.papel !== undefined && !isPapel(dados.papel)) return { ok: false, error: "papel_invalido" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  if (await seriaUltimoAdminAtivo(supabase, clinicaId, atual, dados)) {
    return { ok: false, error: "ultimo_admin" };
  }

  const payload: Record<string, unknown> = {};
  if (dados.nome !== undefined) payload.nome = dados.nome.trim();
  if (dados.papel !== undefined) payload.papel = dados.papel;
  if (dados.ativo !== undefined) payload.ativo = dados.ativo;

  const { data, error } = await supabase
    .from("atendentes")
    .update(payload)
    .eq("id", id)
    .eq("clinica_id", clinicaId)
    .select("id, nome, usuario, papel, ativo")
    .single();

  if (error || !data) {
    console.error("[atendentes] atualizar_failed", JSON.stringify({ code: error?.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  return {
    ok: true,
    atendente: {
      id: data.id as string,
      nome: data.nome as string,
      usuario: data.usuario as string,
      papel: data.papel as Papel,
      ativo: data.ativo as boolean,
    },
  };
}

/** Admin define senha nova pra outra conta (ex.: pessoa esqueceu) — diferente de "esqueci minha senha" self-service, que precisa de e-mail e ainda não existe. */
export async function trocarSenhaAtendente(
  clinicaId: string,
  id: string,
  novaSenha: string
): Promise<{ ok: boolean; error?: string }> {
  if (novaSenha.length < 8) return { ok: false, error: "senha_muito_curta" };

  const atual = await buscarAtendentePorId(clinicaId, id);
  if (!atual) return { ok: false, error: "not_found" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { error } = await supabase
    .from("atendentes")
    .update({ senha_hash: hashSenha(novaSenha) })
    .eq("id", id)
    .eq("clinica_id", clinicaId);

  if (error) {
    console.error("[atendentes] trocar_senha_failed", JSON.stringify({ code: error.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  return { ok: true };
}
