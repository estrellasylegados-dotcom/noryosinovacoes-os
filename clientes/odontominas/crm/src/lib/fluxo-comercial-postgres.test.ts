import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { criarBancoFluxosTeste } from "@/test/fluxo-postgres";

let db: PGlite;
let clinica: string, paciente: string, conversa: string, pipeline: string, oportunidade: string, fluxo: string, versao: string;
let etapas: Record<string, string>;
let config: Record<string, unknown>;
async function one<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0];
}
async function mover(nome: string) {
  const o = await one("select versao from oportunidades where id=$1", [oportunidade]);
  return one("select mover_oportunidade($1,$2,$3,$4,null) r", [clinica,oportunidade,etapas[nome],o.versao]);
}
async function iniciar() {
  const ev = await one("select id,detalhe from automacao_eventos where clinica_id=$1 and entrega_estado is not null order by created_at desc,id desc limit 1",[clinica]);
  return (await one("select fluxo_iniciar_comercial($1,$2,$3,$4,$5,$6,now()) r",[clinica,fluxo,versao,ev.id,JSON.stringify(config),`evento:${ev.id}`])).r as {ok:boolean;execucaoId:string;deduplicado:boolean;error?:string};
}
async function claim(id: string) { return (await one("select fluxo_reivindicar($1,$2) r",[clinica,id])).r as {id:string;token:string;sequencia:number}|null; }
async function autorizar(id: string, token: string, contato=false) { return (await one("select fluxo_autorizar_passo($1,$2,$3,$4) r",[clinica,id,token,contato])).r; }

describe("Fluxos comerciais — migrations e contratos no PostgreSQL isolado",()=>{
  beforeAll(async()=>{db=await criarBancoFluxosTeste();},60000);
  afterAll(async()=>{await db?.close();});
  beforeEach(async()=>{
    // Apenas este banco efêmero. Nenhuma conexão externa existe no helper.
    await db.exec("truncate clinicas cascade;");
    clinica=(await one("insert into clinicas default values returning id")).id as string;
    paciente=(await one("insert into pacientes(clinica_id,nome) values($1,'[TESTE] Paciente') returning id",[clinica])).id as string;
    conversa=(await one("insert into conversas(clinica_id,paciente_id) values($1,$2) returning id",[clinica,paciente])).id as string;
    pipeline=(await one("select garantir_pipeline_padrao($1) id",[clinica])).id as string;
    etapas=Object.fromEntries((await db.query<{nome:string;id:string}>("select nome,id from pipeline_estagios where pipeline_id=$1",[pipeline])).rows.map(e=>[e.nome,e.id]));
    config={pipelineId:pipeline,etapaId:etapas['Follow-up'],modo:'entrada',tempoSegundos:0,reentrada:'por_entrada',pararAoSair:true,pararAoResponder:true,respeitarHorario:true,aceitarOrigemAutomacao:false};
    fluxo=(await one("insert into fluxos(clinica_id,nome,status,gatilho_tipo,gatilho_config) values($1,'[TESTE AUTOMAÇÃO KANBAN]','ativo','kanban_stage_changed',$2) returning id",[clinica,JSON.stringify(config)])).id as string;
    versao=(await one("insert into fluxo_versoes(fluxo_id,clinica_id,numero,status,definicao) values($1,$2,1,'publicada',$3) returning id",[fluxo,clinica,JSON.stringify({nodes:[{id:'inicio',tipo:'inicio',proximo:'fim'},{id:'fim',tipo:'finalizar'}],edges:[],config:{gatilho:{tipo:'kanban_stage_changed',config}}})])).id as string;
    oportunidade=((await one("select criar_oportunidade($1,$2,$3,null) r",[clinica,paciente,conversa])).r as {oportunidade_id:string}).oportunidade_id;
  });
  it("entrada inicial em Novo produz outbox na transação",async()=>{
    const ev=await one("select detalhe from automacao_eventos where clinica_id=$1",[clinica]);
    expect(ev.detalhe).toMatchObject({oportunidade_id:oportunidade,stage_from:null,stage_to:etapas.Novo,conversa_id:conversa});
  });
  it("rollback da movimentação não deixa evento órfão",async()=>{
    await db.exec('begin'); await mover('Follow-up'); await db.exec('rollback');
    expect((await one("select count(*)::int n from automacao_eventos")).n).toBe(1);
  });
  it("evento duplicado inicia exatamente uma execução sem ocupar o Chat",async()=>{
    await mover('Follow-up'); const a=await iniciar(),b=await iniciar();
    expect(a.ok).toBe(true); expect(b.deduplicado).toBe(true);
    expect((await one("select count(*)::int n from fluxo_execucoes")).n).toBe(1);
    expect(await one("select dono_conversa,fluxo_execucao_ativa_id from conversas where id=$1",[conversa])).toEqual({dono_conversa:'humano',fluxo_execucao_ativa_id:null});
  });
  it("dois pedidos de claim: um único token; token alheio não autoriza",async()=>{
    await mover('Follow-up'); const e=await iniciar();
    const claims=await Promise.all([claim(e.execucaoId),claim(e.execucaoId)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await autorizar(e.execucaoId,crypto.randomUUID())).toEqual({ok:false,error:'claim_perdido'});
  });
  it("Agendado cancela e conclusão tardia não ressuscita o fluxo",async()=>{
    await mover('Follow-up'); const e=await iniciar(),c=(await claim(e.execucaoId))!;
    await mover('Agendado');
    expect(await autorizar(e.execucaoId,c.token,true)).toEqual({ok:false,error:'claim_perdido'});
    expect((await one("select fluxo_concluir_passo($1,$2,$3,$4) ok",[clinica,e.execucaoId,c.token,JSON.stringify({estado:'queued',no_atual_id:'fim'})])).ok).toBe(false);
    expect((await one("select estado from fluxo_execucoes where id=$1",[e.execucaoId])).estado).toBe('cancelled');
  });
  it("resposta durante espera cancela mesmo sem texto",async()=>{
    await mover('Follow-up'); const e=await iniciar();
    await one("insert into mensagens(clinica_id,conversa_id,direcao) values($1,$2,'recebida') returning id",[clinica,conversa]);
    expect((await one("select motivo_finalizacao from fluxo_execucoes where id=$1",[e.execucaoId])).motivo_finalizacao).toBe('paciente_respondeu');
  });
  it("waiting_input mantém a captura explícita",async()=>{
    await mover('Follow-up'); const e=await iniciar();
    await db.query("update fluxo_execucoes set estado='waiting_input',ocupa_conversa=true where id=$1",[e.execucaoId]);
    await db.query("insert into mensagens(clinica_id,conversa_id,direcao) values($1,$2,'recebida')",[clinica,conversa]);
    expect((await one("select estado from fluxo_execucoes where id=$1",[e.execucaoId])).estado).toBe('waiting_input');
  });
  it("evento atrasado de uma entrada anterior não inicia depois de sair e voltar",async()=>{
    await mover('Follow-up'); const ev=await one("select id from automacao_eventos order by created_at desc limit 1");
    await mover('Agendado'); await mover('Follow-up');
    const r=await one("select fluxo_iniciar_comercial($1,$2,$3,$4,$5,'antigo',now()) r",[clinica,fluxo,versao,ev.id,JSON.stringify(config)]);
    expect(r.r).toEqual({ok:false,error:'etapa_alterada'});
  });
  it("versão do destinatário fica fixa na ocorrência",async()=>{
    await mover('Follow-up'); await db.query("update fluxo_versoes set status='substituida' where id=$1",[versao]);
    const e=await iniciar(); expect(e.ok).toBe(true);
    expect((await one("select versao_id from fluxo_execucoes where id=$1",[e.execucaoId])).versao_id).toBe(versao);
  });
  it("clínica alheia não reivindica nem inicia execução",async()=>{
    await mover('Follow-up'); const e=await iniciar(); const outra=crypto.randomUUID();
    expect((await one("select fluxo_reivindicar($1,$2) r",[outra,e.execucaoId])).r).toBeNull();
    const c=(await claim(e.execucaoId))!;
    expect((await one("select fluxo_autorizar_passo($1,$2,$3,true) r",[outra,e.execucaoId,c.token])).r).toEqual({ok:false,error:'contexto_invalido'});
  });
  it("RPC de produção não é executável por anon/authenticated",async()=>{
    expect((await one("select has_function_privilege('anon','fluxo_reivindicar(uuid,uuid,boolean,boolean)','execute') pode")).pode).toBe(false);
  });
});
