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
