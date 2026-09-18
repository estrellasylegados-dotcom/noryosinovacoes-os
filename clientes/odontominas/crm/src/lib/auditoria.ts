import { getSupabaseServerClient } from "@/lib/supabase";

export type DadosEvento = {
  clinicaId?: string | null;
  atorId?: string | null;
  atorPerfil?: string | null;
  evento: string;
  alvoId?: string | null;
  detalhes?: Record<string, unknown>;
};

/**
 * Trilha de auditoria (seção 45/46 do pedido) — nunca recebe senha ou token
 * puro (só hash/metadado); falha de auditoria nunca derruba o fluxo
 * principal (loga e segue, não propaga erro pro chamador).
 */
export async function registrarEvento(dados: DadosEvento): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  const { error } = await supabase.from("auditoria_eventos").insert({
    clinica_id: dados.clinicaId ?? null,
    ator_id: dados.atorId ?? null,
    ator_perfil: dados.atorPerfil ?? null,
    evento: dados.evento,
    alvo_id: dados.alvoId ?? null,
    detalhes: dados.detalhes ?? {},
  });

  if (error) {
    console.error("[auditoria] registrar_failed", JSON.stringify({ code: error.code ?? null, evento: dados.evento }));
  }
}
