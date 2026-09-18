import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase";
import { hashSenha } from "@/lib/senha";
import { isPerfilValido, type Perfil } from "@/lib/permissoes";
import { registrarEvento } from "@/lib/auditoria";

export type StatusAtendente = "invited" | "pending_approval" | "active" | "blocked" | "disabled";

const STATUS_VALIDOS: readonly StatusAtendente[] = ["invited", "pending_approval", "active", "blocked", "disabled"];

export function isStatusValido(v: string): v is StatusAtendente {
  return (STATUS_VALIDOS as readonly string[]).includes(v);
}

export type Atendente = {
  id: string;
  nome: string;
  usuario: string;
  email: string | null;
  perfil: Perfil;
  status: StatusAtendente;
  ativo: boolean;
  clinicaId: string | null;
};

/** Sessão (src/lib/sessao-servidor.ts) precisa disto pra reautorizar a cada request — não filtra por clínica porque contas de plataforma (noryos_admin/noryos_suporte) têm clinica_id null. */
export type AtendenteCompleto = Atendente & { sessaoVersao: number; permissoesCustomizadas: string[] | null };

/** `ativo` é sempre derivado de `status` — nunca escrito direto fora daqui, pra não divergir do que o resto do código (18 pontos) ainda lê como booleano legado. */
function ativoDoStatus(status: StatusAtendente): boolean {
  return status === "active";
}

/** Mesma normalização já usada no login (api/login/route.ts) — precisa bater pra não criar conta que nunca loga. */
export function normalizarUsuario(usuario: string): string {
  return usuario.trim().toLowerCase();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

function linhaParaAtendente(r: Record<string, unknown>): Atendente | null {
  const perfil = r.perfil as string;
  const status = r.status as string;
  if (!isPerfilValido(perfil) || !isStatusValido(status)) return null;
  return {
    id: r.id as string,
    nome: r.nome as string,
    usuario: r.usuario as string,
    email: (r.email as string | null) ?? null,
    perfil,
    status,
    ativo: r.ativo as boolean,
    clinicaId: (r.clinica_id as string | null) ?? null,
  };
}

/** Login: busca conta por usuário (qualquer status — o chamador decide o que fazer com invited/blocked/etc). Inclui o hash — só pra uso interno da rota de login. */
export async function buscarAtendentePorUsuario(
  clinicaId: string,
  usuario: string
): Promise<(Atendente & { senhaHash: string | null; sessaoVersao: number }) | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !usuario) return null;

  const { data, error } = await supabase
    .from("atendentes")
    .select("id, nome, usuario, email, senha_hash, perfil, status, ativo, clinica_id, sessao_versao")
    .eq("clinica_id", clinicaId)
    .eq("usuario", usuario)
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
  const atendente = linhaParaAtendente(data);
  if (!atendente) return null;

  return {
    ...atendente,
    senhaHash: (data.senha_hash as string | null) ?? null,
    sessaoVersao: data.sessao_versao as number,
  };
}

/** Sessão (Node, autoridade real): busca por id, sem filtro de clínica — contas de plataforma não têm clinica_id. */
export async function buscarAtendenteCompletoPorId(id: string): Promise<AtendenteCompleto | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase || !id) return null;

  const { data, error } = await supabase
    .from("atendentes")
    .select("id, nome, usuario, email, perfil, status, ativo, clinica_id, sessao_versao, permissoes_customizadas")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const atendente = linhaParaAtendente(data);
  if (!atendente) return null;

  return {
    ...atendente,
    sessaoVersao: data.sessao_versao as number,
    permissoesCustomizadas: (data.permissoes_customizadas as string[] | null) ?? null,
  };
}

/** Equipe: lista todo mundo da clínica, qualquer status, pra Equipe mostrar o time completo. */
export async function listarAtendentes(clinicaId: string): Promise<Atendente[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("atendentes")
    .select("id, nome, usuario, email, perfil, status, ativo, clinica_id")
    .eq("clinica_id", clinicaId)
    .order("nome", { ascending: true });

  if (error || !data) {
    if (error) console.error("[atendentes] listar_failed", JSON.stringify({ code: error.code ?? null }));
    return [];
  }

  return data.map(linhaParaAtendente).filter((a): a is Atendente => a !== null);
}

export async function buscarAtendentePorId(clinicaId: string, id: string): Promise<Atendente | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("atendentes")
    .select("id, nome, usuario, email, perfil, status, ativo, clinica_id")
    .eq("clinica_id", clinicaId)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return linhaParaAtendente(data);
}

/** Gera um `usuario` a partir do local-part do e-mail (login continua por usuário, não por e-mail — ver docs/RBAC.md). Resolve colisão com sufixo numérico. */
export async function gerarUsuarioUnico(clinicaId: string | null, email: string): Promise<string> {
  const base = normalizarUsuario(email.split("@")[0] ?? "").replace(/[^a-z0-9._-]/g, "") || "usuario";
  const supabase = getSupabaseServerClient();
  if (!supabase) return base;

  let candidato = base;
  let sufixo = 1;
  for (;;) {
    let query = supabase.from("atendentes").select("id", { count: "exact", head: true }).eq("usuario", candidato);
    query = clinicaId ? query.eq("clinica_id", clinicaId) : query.is("clinica_id", null);
    const { count } = await query;
    if (!count) return candidato;
    sufixo += 1;
    candidato = `${base}${sufixo}`;
  }
}

export type DadosConviteAtendente = { nome: string; email: string; perfil: string };

/** Pura, sem I/O — testável direto. */
export function validarDadosConvite(dados: DadosConviteAtendente): string | null {
  if (!dados.nome.trim()) return "nome_obrigatorio";
  const email = normalizarEmail(dados.email);
  if (!EMAIL_REGEX.test(email)) return "email_invalido";
  if (!isPerfilValido(dados.perfil)) return "perfil_invalido";
  return null;
}

/**
 * Cria a conta em `status: invited`, sem senha (ver v29) — quem chama é
 * responsável por gerar e enviar o convite (src/lib/convites.ts) e por
 * checar `usuarios.criar` + `podeAtribuirPerfil` antes de chegar aqui
 * (autorização é decisão de rota, não desta função).
 */
export async function criarAtendenteConvidado(
  clinicaId: string | null,
  dados: DadosConviteAtendente,
  criadoPorId: string
): Promise<{ ok: boolean; atendente?: Atendente; error?: string }> {
  const erro = validarDadosConvite(dados);
  if (erro) return { ok: false, error: erro };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const email = normalizarEmail(dados.email);
  const usuario = await gerarUsuarioUnico(clinicaId, email);
  const status: StatusAtendente = "invited";

  const { data, error } = await supabase
    .from("atendentes")
    .insert({
      clinica_id: clinicaId,
      nome: dados.nome.trim(),
      usuario,
      email,
      senha_hash: null,
      perfil: dados.perfil,
      papel: dados.perfil === "dona" || dados.perfil === "noryos_admin" ? "admin" : "atendente",
      status,
      ativo: ativoDoStatus(status),
      criado_por: criadoPorId,
    })
    .select("id, nome, usuario, email, perfil, status, ativo, clinica_id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "email_ja_existe" };
    console.error("[atendentes] criar_convidado_failed", JSON.stringify({ code: error?.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  const atendente = linhaParaAtendente(data);
  if (!atendente) return { ok: false, error: "persist_failed" };

  await registrarEvento({
    clinicaId,
    atorId: criadoPorId,
    evento: "USER_INVITED",
    alvoId: atendente.id,
    detalhes: { perfil: dados.perfil, email },
  });

  return { ok: true, atendente };
}

/**
 * Se esta mudança tiraria a última Dona ativa da clínica (desativar/
 * bloquear ou rebaixar), barra — sem isso a clínica fica sem ninguém que
 * consiga reverter, e só um UPDATE manual via SQL/MCP destrava.
 */
async function seriaUltimaDonaAtiva(
  supabase: SupabaseClient,
  clinicaId: string,
  atual: Atendente,
  dados: Partial<{ perfil: Perfil; status: StatusAtendente }>
): Promise<boolean> {
  const perderiaStatusDeDonaAtiva =
    atual.perfil === "dona" &&
    atual.status === "active" &&
    ((dados.status !== undefined && dados.status !== "active") || (dados.perfil !== undefined && dados.perfil !== "dona"));
  if (!perderiaStatusDeDonaAtiva) return false;

  const { count } = await supabase
    .from("atendentes")
    .select("id", { count: "exact", head: true })
    .eq("clinica_id", clinicaId)
    .eq("perfil", "dona")
    .eq("status", "active")
    .neq("id", atual.id);

  return (count ?? 0) === 0;
}

export async function atualizarAtendente(
  clinicaId: string,
  id: string,
  dados: Partial<{ nome: string; perfil: Perfil; status: StatusAtendente }>,
  atorId: string
): Promise<{ ok: boolean; atendente?: Atendente; error?: string }> {
  const atual = await buscarAtendentePorId(clinicaId, id);
  if (!atual) return { ok: false, error: "not_found" };

  if (dados.nome !== undefined && !dados.nome.trim()) return { ok: false, error: "nome_obrigatorio" };
  if (dados.perfil !== undefined && !isPerfilValido(dados.perfil)) return { ok: false, error: "perfil_invalido" };
  if (dados.status !== undefined && !isStatusValido(dados.status)) return { ok: false, error: "status_invalido" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  if (await seriaUltimaDonaAtiva(supabase, clinicaId, atual, dados)) {
    return { ok: false, error: "ultima_dona" };
  }

  const payload: Record<string, unknown> = {};
  if (dados.nome !== undefined) payload.nome = dados.nome.trim();
  if (dados.perfil !== undefined) payload.perfil = dados.perfil;
  if (dados.status !== undefined) {
    payload.status = dados.status;
    payload.ativo = ativoDoStatus(dados.status);
  }

  const { data, error } = await supabase
    .from("atendentes")
    .update(payload)
    .eq("id", id)
    .eq("clinica_id", clinicaId)
    .select("id, nome, usuario, email, perfil, status, ativo, clinica_id")
    .single();

  if (error || !data) {
    console.error("[atendentes] atualizar_failed", JSON.stringify({ code: error?.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  if (dados.status !== undefined && dados.status !== "active") {
    await bumpSessaoVersao(id);
  }

  const atendente = linhaParaAtendente(data);
  if (!atendente) return { ok: false, error: "persist_failed" };

  await registrarEvento({
    clinicaId,
    atorId,
    evento: eventoDaAtualizacao(dados),
    alvoId: id,
    detalhes: dados,
  });

  return { ok: true, atendente };
}

function eventoDaAtualizacao(dados: Partial<{ nome: string; perfil: Perfil; status: StatusAtendente }>): string {
  if (dados.perfil !== undefined) return "ROLE_CHANGED";
  if (dados.status === "disabled") return "USER_DISABLED";
  if (dados.status === "blocked") return "MEMBERSHIP_BLOCKED";
  if (dados.status === "active") return "USER_REACTIVATED";
  return "USER_UPDATED";
}

/** Incrementa a versão de sessão — todo token emitido antes disso deixa de bater (ver src/lib/sessao.ts). Usado por bloqueio/desativação/reset de senha/"encerrar sessões". */
export async function bumpSessaoVersao(atendenteId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { data } = await supabase.from("atendentes").select("sessao_versao").eq("id", atendenteId).maybeSingle();
  const atual = (data?.sessao_versao as number | undefined) ?? 0;
  await supabase.from("atendentes").update({ sessao_versao: atual + 1 }).eq("id", atendenteId);
}

/** Admin define senha nova pra outra conta (ex.: pessoa esqueceu) — diferente de "esqueci minha senha" self-service (src/lib/reset-senha.ts), que precisa de e-mail. Revoga sessões da conta, mesma razão do bloqueio. */
export async function trocarSenhaAtendente(
  clinicaId: string,
  id: string,
  novaSenha: string,
  atorId: string
): Promise<{ ok: boolean; error?: string }> {
  if (novaSenha.length < 8) return { ok: false, error: "senha_muito_curta" };

  const atual = await buscarAtendentePorId(clinicaId, id);
  if (!atual) return { ok: false, error: "not_found" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { error } = await supabase.from("atendentes").update({ senha_hash: hashSenha(novaSenha) }).eq("id", id).eq("clinica_id", clinicaId);

  if (error) {
    console.error("[atendentes] trocar_senha_failed", JSON.stringify({ code: error.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  await bumpSessaoVersao(id);
  await registrarEvento({ clinicaId, atorId, evento: "SUPORTE_RESETAR_SENHA", alvoId: id, detalhes: {} });

  return { ok: true };
}

/** Dona/Noryos Admin ajusta as permissões de alguém — `null` volta pro default do perfil, array (mesmo vazio) fixa a lista exata. */
export async function definirPermissoesCustomizadas(
  clinicaId: string,
  id: string,
  permissoes: string[] | null,
  atorId: string
): Promise<{ ok: boolean; error?: string }> {
  const atual = await buscarAtendentePorId(clinicaId, id);
  if (!atual) return { ok: false, error: "not_found" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { error } = await supabase
    .from("atendentes")
    .update({ permissoes_customizadas: permissoes })
    .eq("id", id)
    .eq("clinica_id", clinicaId);

  if (error) return { ok: false, error: "persist_failed" };

  await registrarEvento({ clinicaId, atorId, evento: "PERMISSIONS_CHANGED", alvoId: id, detalhes: { permissoes } });
  return { ok: true };
}
