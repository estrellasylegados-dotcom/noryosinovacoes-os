import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Esta instância do CRM atende uma única clínica — arquitetura "path B"
 * (ver andamento.md): o modelo de dado já é multi-clínica (`clinica_id` em
 * toda tabela), mas cada clínica roda numa instância própria por enquanto.
 * O slug fixo evita hardcodar o id em cada query.
 */
const CLINICA_SLUG = process.env.CLINICA_SLUG || "odontominas";

let cachedId: string | null | undefined;

export async function getClinicaId(): Promise<string | null> {
  if (cachedId !== undefined) return cachedId;

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    cachedId = null;
    return cachedId;
  }

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
    cachedId = null;
    return cachedId;
  }

  cachedId = data.id as string;
  return cachedId;
}
