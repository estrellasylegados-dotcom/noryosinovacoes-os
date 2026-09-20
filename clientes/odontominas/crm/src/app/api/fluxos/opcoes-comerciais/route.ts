import { NextResponse } from "next/server";
import { autorizarFluxos } from "@/lib/fluxo-http";
import { getSupabaseServerClient } from "@/lib/supabase";
export async function GET() {
  const auth = await autorizarFluxos("automacoes.visualizar");
  if ("erro" in auth) return auth.erro;
  const db = getSupabaseServerClient();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });
  const [pipelines, etapas, motivos, canais] = await Promise.all([
    db.from("pipelines").select("id,nome").eq("clinica_id", auth.clinicaId).eq("ativo", true).order("nome"),
    db.from("pipeline_estagios").select("id,nome,pipeline_id,tipo").eq("clinica_id", auth.clinicaId).eq("ativo", true).order("ordem"),
    db.from("motivos_perda").select("id,nome").eq("clinica_id", auth.clinicaId).eq("ativo", true).order("ordem"),
    db.from("canais").select("id,nome").eq("clinica_id", auth.clinicaId).order("nome"),
  ]);
  if ([pipelines,etapas,motivos,canais].some(r => r.error)) return NextResponse.json({ ok: false }, { status: 503 });
  return NextResponse.json({ ok: true, pipelines: pipelines.data, etapas: etapas.data, motivos: motivos.data, canais: canais.data });
}
