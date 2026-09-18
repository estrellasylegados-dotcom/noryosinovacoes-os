import { getSupabaseServerClient } from "@/lib/supabase";

export type NotaInterna = {
  id: string;
  conversaId: string;
  atendenteId: string | null;
  atendenteNome: string | null;
  texto: string;
  criadaEm: string;
};

const LIMITE_TEXTO = 2000;

/** Pura, sem I/O — testável direto (mesmo critério de `validarDadosNovoAtendente` em atendentes.ts). */
export function validarTextoNota(textoBruto: string): string | null {
  const texto = textoBruto.trim();
  if (!texto) return "texto_vazio";
  if (texto.length > LIMITE_TEXTO) return "texto_muito_longo";
  return null;
}

type LinhaNota = {
  id: unknown;
  conversa_id: unknown;
  atendente_id: unknown;
  texto: unknown;
  created_at: unknown;
  atendentes: { nome?: string } | { nome?: string }[] | null;
};

function mapNota(n: LinhaNota): NotaInterna {
  const atendente = Array.isArray(n.atendentes) ? n.atendentes[0] : n.atendentes;
  return {
    id: n.id as string,
    conversaId: n.conversa_id as string,
    atendenteId: n.atendente_id as string | null,
    atendenteNome: atendente?.nome ?? null,
    texto: n.texto as string,
    criadaEm: n.created_at as string,
  };
}

const SELECT_NOTA = "id, conversa_id, atendente_id, texto, created_at, atendentes(nome)";

/** Nunca vista pelo paciente — webhook e motor do Fluxo de Conversa nunca leem esta tabela. */
export async function buscarNotasInternas(clinicaId: string, conversaId: string): Promise<NotaInterna[] | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data: conversa } = await supabase
    .from("conversas")
    .select("id")
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (!conversa) return null;

  const { data, error } = await supabase
    .from("notas_internas")
    .select(SELECT_NOTA)
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    if (error) console.error("[notas-internas] listar_failed", JSON.stringify({ code: error.code ?? null }));
    return [];
  }

  return (data as unknown as LinhaNota[]).map(mapNota);
}

export async function criarNotaInterna(
  clinicaId: string,
  conversaId: string,
  atendenteId: string | null,
  textoBruto: string
): Promise<{ ok: boolean; nota?: NotaInterna; error?: string }> {
  const erro = validarTextoNota(textoBruto);
  if (erro) return { ok: false, error: erro };

  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const { data: conversa } = await supabase
    .from("conversas")
    .select("id")
    .eq("id", conversaId)
    .eq("clinica_id", clinicaId)
    .maybeSingle();
  if (!conversa) return { ok: false, error: "not_found" };

  const { data, error } = await supabase
    .from("notas_internas")
    .insert({ clinica_id: clinicaId, conversa_id: conversaId, atendente_id: atendenteId, texto: textoBruto.trim() })
    .select(SELECT_NOTA)
    .single();

  if (error || !data) {
    console.error("[notas-internas] criar_failed", JSON.stringify({ code: error?.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }

  return { ok: true, nota: mapNota(data as unknown as LinhaNota) };
}
