import { getSupabaseServerClient } from "@/lib/supabase";
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
