import { getSupabaseServerClient } from "@/lib/supabase";
import { emitirEventoAutomacao } from "@/lib/fluxo-eventos-internos";
/** Chamado pelo worker de Fluxos já existente; processa no máximo uma agenda por ciclo. */
export async function processarAgendamentoReputacaoDevido(clinicaId: string): Promise<boolean> {
  const db=getSupabaseServerClient(); if(!db) return false;
  const {data}=await db.from("reputacao_agendamentos").select("id,paciente_id,atendimento_id,tipo,tentativas").eq("clinica_id",clinicaId).eq("status","pendente").lte("devido_em",new Date().toISOString()).order("devido_em",{ascending:true}).limit(1).maybeSingle();
  if(!data) return false;
  const claim=await db.from("reputacao_agendamentos").update({status:"processando",tentativas:(data.tentativas as number)+1,updated_at:new Date().toISOString()}).eq("id",data.id).eq("status","pendente").select("id").maybeSingle();
  if(!claim.data) return false;
  const resultado=await emitirEventoAutomacao({clinicaId,pacienteId:data.paciente_id as string,tipo:"solicitacao_avaliacao_google",referenciaId:data.atendimento_id as string,metadata:{atendimento_id:data.atendimento_id as string}});
  if(resultado.resultado==="execucao_iniciada"||resultado.resultado==="idempotencia_existente") { await db.from("reputacao_agendamentos").update({status:"concluido",updated_at:new Date().toISOString()}).eq("id",data.id); return true; }
  await db.from("reputacao_agendamentos").update({status:"pendente",devido_em:new Date(Date.now()+5*60_000).toISOString(),updated_at:new Date().toISOString()}).eq("id",data.id); return false;
}
