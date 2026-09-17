import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Esta instância do CRM atende uma única clínica — arquitetura "path B"
 * (ver andamento.md): o modelo de dado já é multi-clínica (`clinica_id` em
 * toda tabela), mas cada clínica roda numa instância própria por enquanto.
 * O slug fixo evita hardcodar o id em cada query.
 */
const CLINICA_SLUG = process.env.CLINICA_SLUG || "odontominas";

// Só guarda em cache o sucesso: o id da clínica não muda em runtime, então
// vale poupar a consulta depois da 1ª vez. Uma falha (Supabase fora do ar,
// erro transiente) NUNCA fica em cache — senão um erro passageiro trava o
// processo inteiro nesse estado até reiniciar (bug real: PGRST303 "JWT
// issued at future" transiente da Supabase derrubou o painel até o próximo
// deploy, porque a versão antiga cacheava `null` igual a um resultado bom).
let cachedId: string | null = null;

export async function getClinicaId(): Promise<string | null> {
  if (cachedId) return cachedId;

  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("clinicas")
    .select("id")
    .eq("slug", CLINICA_SLUG)
    .maybeSingle();

  if (error || !data) {
    console.error(
      "[clinica] lookup_failed",
      JSON.stringify({
        slug: CLINICA_SLUG,
        code: (error as { code?: string } | null)?.code ?? null,
        message: (error?.message ?? "").slice(0, 200) || null,
      })
    );
    return null;
  }

  cachedId = data.id as string;
  return cachedId;
}

export type ClinicaAtual = { id: string; nome: string; slug: string };

// Mesmo critério de `cachedId` acima: só sucesso fica em cache (nome de
// clínica não muda em runtime, mas uma falha transiente do Supabase não pode
// travar o processo com "sem nome" pra sempre).
let cachedClinicaAtual: ClinicaAtual | null = null;

/**
 * Fase 3 (white-label — ver _memoria/decisoes.md): fonte única do nome de
 * exibição da clínica, pra `resolverVariaveis`/`resolverVariaveisFluxo`
 * (`{clinica_nome}`) e pras poucas telas que hoje têm "OdontoMinas" fixo.
 * Não é multi-tenant runtime — só elimina o hardcode, mesma arquitetura
 * "path B" de `getClinicaId`.
 */
export async function buscarClinicaAtual(): Promise<ClinicaAtual | null> {
  if (cachedClinicaAtual) return cachedClinicaAtual;

  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from("clinicas").select("id, nome, slug").eq("slug", CLINICA_SLUG).maybeSingle();
  if (error || !data) return null;

  cachedClinicaAtual = { id: data.id as string, nome: data.nome as string, slug: data.slug as string };
  return cachedClinicaAtual;
}

/**
 * Apelido interno da instância de WhatsApp (sidebar + página Conexão) —
 * nunca é enviado pra Evolution API, é só rótulo local (migração
 * 2026-09-15_v7_apelido_instancia.sql). null = ainda não definido, o app
 * cai no profileName real do WhatsApp.
 */
export async function buscarApelidoInstancia(clinicaId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from("clinicas").select("apelido_instancia").eq("id", clinicaId).maybeSingle();
  if (error || !data) return null;

  return (data.apelido_instancia as string | null) ?? null;
}

export async function salvarApelidoInstancia(
  clinicaId: string,
  apelidoBruto: string
): Promise<{ ok: boolean; error?: string }> {
  const apelido = apelidoBruto.trim();
  if (!apelido) return { ok: false, error: "nome_vazio" };
  if (apelido.length > 60) return { ok: false, error: "nome_muito_longo" };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { error } = await supabase.from("clinicas").update({ apelido_instancia: apelido }).eq("id", clinicaId);
  if (error) return { ok: false, error: "update_failed" };

  return { ok: true };
}
