import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Busca de contato pro "Testar fluxo" do editor visual (Fase 2b/3) — nunca
 * hardcoda um número mágico no código. Telefone é único por clínica em
 * `pacientes` e em `conversas` (ver comentário em `pacientes.ts`) — path B
 * garante 1 conversa por paciente, então o par {pacienteId, conversaId} é
 * sempre 1:1. 2 queries (não embed) de propósito: evita qualquer risco de
 * ambiguidade de relação no PostgREST (já achado real em `fluxo-execucoes.ts`
 * pra outro embed envolvendo `conversas`).
 */

export type ContatoTeste = { pacienteId: string; nome: string | null; telefone: string; conversaId: string };

const LIMITE_RESULTADOS = 10;

export async function buscarContatosParaTeste(clinicaId: string, query: string): Promise<ContatoTeste[]> {
  // "," e "(" quebrariam a sintaxe do filtro .or() do PostgREST (não é risco
  // de injeção — supabase-js parametriza — só corromperia a busca).
  const termo = query.trim().replace(/[,()]/g, " ").trim();
  if (!termo) return [];

  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const { data: pacientes, error: erroPacientes } = await supabase
    .from("pacientes")
    .select("id, nome, telefone")
    .eq("clinica_id", clinicaId)
    .or(`nome.ilike.%${termo}%,telefone.ilike.%${termo}%`)
    .limit(LIMITE_RESULTADOS);

  if (erroPacientes || !pacientes || pacientes.length === 0) return [];

  const { data: conversas } = await supabase
    .from("conversas")
    .select("id, paciente_id")
    .eq("clinica_id", clinicaId)
    .in("paciente_id", pacientes.map((p) => p.id as string));

  const conversaPorPaciente = new Map((conversas ?? []).map((c) => [c.paciente_id as string, c.id as string]));

  return pacientes
    .map((p): ContatoTeste | null => {
      const conversaId = conversaPorPaciente.get(p.id as string);
      if (!conversaId) return null;
      return { pacienteId: p.id as string, nome: (p.nome as string | null) ?? null, telefone: p.telefone as string, conversaId };
    })
    .filter((c): c is ContatoTeste => c !== null);
}
