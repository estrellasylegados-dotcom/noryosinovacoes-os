import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase server-side do CRM da OdontoMinas — banco dedicado
 * (projeto `odontominas-crm`, separado do Diagnóstico Digital). Usa a
 * service role key, que ignora RLS: nunca importar em Client Components.
 */
let cached: SupabaseClient | null | undefined;

export function getSupabaseServerClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    cached = null;
    return cached;
  }

  cached = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}
