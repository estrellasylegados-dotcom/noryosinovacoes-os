-- V36: evolução do ÚNICO motor de Fluxos. Proposta; aplicar em produção só com aprovação.
-- Requer v35. Sem replay/backfill de eventos antigos e sem ativar fluxos.
-- A única substituição de índice separa execução agendada de posse da conversa.
begin;

alter table public.fluxo_execucoes
  add column oportunidade_id uuid references public.oportunidades(id) on delete restrict,
  add column contexto_comercial jsonb,
  add column ocupa_conversa boolean not null default true,
  add column claim_token uuid,
  add column claim_ate timestamptz,
  add column marco_resposta_em timestamptz;
alter table public.fluxo_execucoes alter column conversa_id drop not null;
-- Eventos de ciclo de vida/agendamento não pertencem a um nó específico.
alter table public.fluxo_execucao_eventos alter column no_id drop not null;
alter table public.fluxo_execucoes add constraint fluxo_contexto_comercial_ck check (
  (oportunidade_id is null and contexto_comercial is null and conversa_id is not null)
  or (oportunidade_id is not null and contexto_comercial is not null)
);
create unique index fluxo_execucoes_controle_conversa_idx on public.fluxo_execucoes(conversa_id)
  where ocupa_conversa and estado in ('queued','running','waiting_time','waiting_input');
drop index public.fluxo_execucoes_conversa_ativa_idx;
create index fluxo_execucoes_oportunidade_idx on public.fluxo_execucoes(clinica_id,oportunidade_id,created_at desc);
create index fluxo_execucoes_due_idx on public.fluxo_execucoes(clinica_id,aguardando_ate,created_at)
  where estado in ('queued','waiting_time','waiting_input');
create index fluxo_execucoes_claim_idx on public.fluxo_execucoes(clinica_id,claim_ate) where estado='running';

alter table public.automacao_eventos
  add column entrega_estado text check (entrega_estado in ('pendente','processando','concluido','falhou')),
  add column entrega_apos timestamptz,
  add column entrega_token uuid,
  add column entrega_tentativas integer not null default 0;
create unique index automacao_eventos_origem_idx on public.automacao_eventos(clinica_id,evento_tipo,referencia_id)
  where entrega_estado is not null;
create index automacao_eventos_pendentes_idx on public.automacao_eventos(clinica_id,entrega_apos)
  where entrega_estado in ('pendente','processando');
create index mensagens_respostas_fluxo_idx on public.mensagens(clinica_id,conversa_id,created_at desc) where direcao='recebida';

-- Uma transição terminal é irrevogável. Um worker antigo nunca a sobrescreve.
create or replace function public.fluxo_proteger_execucao() returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='UPDATE' and old.estado in ('completed','cancelled','failed','transferred') and new.estado is distinct from old.estado then
    return null;
  end if;
  if not exists(select 1 from public.fluxos f join public.fluxo_versoes v on v.fluxo_id=f.id
    where f.id=new.fluxo_id and v.id=new.versao_id and f.clinica_id=new.clinica_id and v.clinica_id=new.clinica_id) then
    raise exception 'fluxo_contexto_invalido' using errcode='23514';
  end if;
  if new.paciente_id is not null and not exists(select 1 from public.pacientes where id=new.paciente_id and clinica_id=new.clinica_id) then
    raise exception 'paciente_contexto_invalido' using errcode='23514';
  end if;
  if new.conversa_id is not null and not exists(select 1 from public.conversas where id=new.conversa_id and clinica_id=new.clinica_id
    and (new.paciente_id is null or paciente_id=new.paciente_id)) then
    raise exception 'conversa_contexto_invalido' using errcode='23514';
  end if;
  if new.oportunidade_id is not null and not exists(select 1 from public.oportunidades where id=new.oportunidade_id
    and clinica_id=new.clinica_id and paciente_id=new.paciente_id) then
    raise exception 'oportunidade_contexto_invalido' using errcode='23514';
  end if;
  return new;
end $$;
create trigger fluxo_proteger_execucao before insert or update on public.fluxo_execucoes for each row execute function public.fluxo_proteger_execucao();

create or replace function public.fluxo_liberar_encerrada() returns trigger language plpgsql set search_path=public as $$
begin
  if new.estado in ('completed','cancelled','failed','transferred') and old.estado not in ('completed','cancelled','failed','transferred') then
    update public.conversas set fluxo_execucao_ativa_id=null,
      dono_conversa=case when dono_conversa='fluxo' then 'humano' else dono_conversa end,updated_at=now()
      where id=new.conversa_id and clinica_id=new.clinica_id and fluxo_execucao_ativa_id=new.id;
    insert into public.fluxo_execucao_eventos(execucao_id,clinica_id,sequencia,tipo_evento,status,payload,is_test)
      values(new.id,new.clinica_id,-1,new.estado,'concluido',jsonb_build_object('motivo',new.motivo_finalizacao),new.is_test)
      on conflict(execucao_id,sequencia) do nothing;
  end if;
  return new;
end $$;
create trigger fluxo_liberar_encerrada after update on public.fluxo_execucoes for each row execute function public.fluxo_liberar_encerrada();

-- Outbox na tabela existente. Snapshot dos destinatários fixa a versão na ocorrência,
-- inclusive se houver publicação ou retry enquanto o evento aguarda processamento.
create or replace function public.fluxo_evento_kanban() returns trigger language plpgsql set search_path=public as $$
declare o public.oportunidades%rowtype; destinos jsonb; cadeia jsonb; causa text;
begin
  if new.tipo not in ('created','stage_changed') then return new; end if;
  select * into o from public.oportunidades where id=new.oportunidade_id and clinica_id=new.clinica_id;
  if not found then return new; end if;
  if new.tipo='stage_changed' then
    update public.fluxo_execucoes set estado='cancelled',motivo_finalizacao=case when o.status<>'open' then 'oportunidade_encerrada' else 'etapa_alterada' end,
      finalizado_em=now(),updated_at=now(),claim_token=null,claim_ate=null
      where clinica_id=o.clinica_id and oportunidade_id=o.id and estado in ('queued','running','waiting_time','waiting_input')
        and (o.status<>'open' or coalesce((contexto_comercial->'config'->>'pararAoSair')::boolean,true));
  end if;
  causa:=nullif(current_setting('app.fluxo_causa',true),'');
  cadeia:='[]'::jsonb;
  if causa is not null then
    select coalesce(contexto_comercial->'cadeia','[]'::jsonb) into cadeia from public.fluxo_execucoes where id=causa::uuid and clinica_id=o.clinica_id;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('fluxo_id',f.id,'versao_id',v.id,'config',v.definicao->'config'->'gatilho'->'config')),'[]'::jsonb)
    into destinos from public.fluxos f join public.fluxo_versoes v on v.fluxo_id=f.id and v.status='publicada'
    where f.clinica_id=o.clinica_id and v.clinica_id=o.clinica_id and f.status='ativo' and f.gatilho_tipo='kanban_stage_changed';
  insert into public.automacao_eventos(clinica_id,paciente_id,evento_tipo,referencia_id,resultado,detalhe,entrega_estado,entrega_apos)
    values(o.clinica_id,o.paciente_id,'kanban_stage_changed',new.id::text,'resumo_agregado',
      jsonb_build_object('id',new.id,'clinica_id',o.clinica_id,'oportunidade_id',o.id,'paciente_id',o.paciente_id,
        'pipeline_id',o.pipeline_id,'stage_from',new.estagio_de,'stage_to',o.estagio_id,'status',o.status,
        'conversa_id',o.conversa_id,'responsavel_id',o.responsavel_id,'actor_id',new.ator_id,'origem',new.origem,
        'occurred_at',new.created_at,'entrada_em',o.estagio_entrou_em,'cadeia',coalesce(cadeia,'[]'::jsonb),'execucao_causa',causa,'destinos',destinos),
      'pendente',now()) on conflict do nothing;
  return new;
end $$;
create trigger fluxo_evento_kanban after insert on public.oportunidade_historico for each row execute function public.fluxo_evento_kanban();

-- Resposta persistida (qualquer mídia) interrompe follow-up; captura explícita mantém o ramo.
create or replace function public.fluxo_resposta_comercial() returns trigger language plpgsql set search_path=public as $$
begin
  if new.direcao='recebida' then
    update public.fluxo_execucoes set estado='cancelled',motivo_finalizacao='paciente_respondeu',finalizado_em=now(),updated_at=now(),claim_token=null,claim_ate=null
      where clinica_id=new.clinica_id and conversa_id=new.conversa_id and oportunidade_id is not null
        and estado in ('queued','running','waiting_time')
        and coalesce((contexto_comercial->'config'->>'pararAoResponder')::boolean,true)
        and new.created_at>marco_resposta_em;
  elsif new.enviada_por_atendente_id is not null then
    update public.fluxo_execucoes set estado='cancelled',motivo_finalizacao='intervencao_humana',finalizado_em=now(),updated_at=now(),claim_token=null,claim_ate=null
      where clinica_id=new.clinica_id and conversa_id=new.conversa_id and oportunidade_id is not null and estado in ('queued','running','waiting_time','waiting_input');
  end if;
  return new;
end $$;
create trigger fluxo_resposta_comercial after insert on public.mensagens for each row execute function public.fluxo_resposta_comercial();

create or replace function public.fluxo_intervencao_comercial() returns trigger language plpgsql set search_path=public as $$
begin
  if new.tipo='CONVERSATION_INTERVENED' then
    update public.fluxo_execucoes set estado='cancelled',motivo_finalizacao='intervencao_humana',finalizado_em=now(),updated_at=now(),claim_token=null,claim_ate=null
      where clinica_id=new.clinica_id and conversa_id=new.conversa_id and oportunidade_id is not null and estado in ('queued','running','waiting_time','waiting_input');
  end if;
  return new;
end $$;
create trigger fluxo_intervencao_comercial after insert on public.conversa_eventos for each row execute function public.fluxo_intervencao_comercial();

create or replace function public.fluxo_reivindicar_evento(p_clinica uuid) returns jsonb language plpgsql set search_path=public as $$
declare r public.automacao_eventos%rowtype;
begin
  select * into r from public.automacao_eventos where clinica_id=p_clinica and entrega_estado in ('pendente','processando')
    and entrega_apos<=now() order by created_at,id for update skip locked limit 1;
  if not found then return null; end if;
  update public.automacao_eventos set entrega_estado='processando',entrega_token=gen_random_uuid(),entrega_apos=now()+interval '2 minutes',entrega_tentativas=entrega_tentativas+1
    where id=r.id returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.fluxo_iniciar_comercial(p_clinica uuid,p_fluxo uuid,p_versao uuid,p_evento uuid,p_config jsonb,p_dedupe text,p_agendado timestamptz,p_teste boolean default false)
returns jsonb language plpgsql set search_path=public as $$
declare ev public.automacao_eventos%rowtype; o public.oportunidades%rowtype; v public.fluxo_versoes%rowtype; inicio text; nova uuid; cadeia jsonb;
begin
  select * into ev from public.automacao_eventos where id=p_evento and clinica_id=p_clinica and evento_tipo='kanban_stage_changed';
  if not found then return jsonb_build_object('ok',false,'error','evento_invalido'); end if;
  if not exists(select 1 from jsonb_array_elements(ev.detalhe->'destinos') d where d->>'fluxo_id'=p_fluxo::text and d->>'versao_id'=p_versao::text) then
    return jsonb_build_object('ok',false,'error','destino_invalido');
  end if;
  if exists(select 1 from public.fluxo_execucoes where fluxo_id=p_fluxo and gatilho_dedupe_key=p_dedupe and clinica_id=p_clinica) then
    return jsonb_build_object('ok',true,'deduplicado',true);
  end if;
  select * into o from public.oportunidades where id=(ev.detalhe->>'oportunidade_id')::uuid and clinica_id=p_clinica;
  if not found then return jsonb_build_object('ok',false,'error','contexto_invalido'); end if;
  -- Não inicia evento atrasado de uma entrada que já terminou, mesmo se voltou à mesma etapa.
  if o.estagio_entrou_em is distinct from (ev.detalhe->>'entrada_em')::timestamptz or o.estagio_id::text<>ev.detalhe->>'stage_to' then
    return jsonb_build_object('ok',false,'error','etapa_alterada');
  end if;
  select v2.* into v from public.fluxo_versoes v2 join public.fluxos f on f.id=v2.fluxo_id
    where v2.id=p_versao and v2.fluxo_id=p_fluxo and v2.clinica_id=p_clinica and f.clinica_id=p_clinica and f.status='ativo'
      and v2.status in ('publicada','substituida');
  if not found then return jsonb_build_object('ok',false,'error','fluxo_inativo'); end if;
  select n->>'id' into inicio from jsonb_array_elements(v.definicao->'nodes') n where n->>'tipo'='inicio';
  if inicio is null then return jsonb_build_object('ok',false,'error','sem_no_inicio'); end if;
  cadeia:=coalesce(ev.detalhe->'cadeia','[]'::jsonb);
  if jsonb_array_length(cadeia)>=10 or cadeia ? p_fluxo::text then return jsonb_build_object('ok',false,'error','loop_bloqueado'); end if;
  insert into public.fluxo_execucoes(clinica_id,fluxo_id,versao_id,conversa_id,paciente_id,oportunidade_id,contexto_comercial,
    ocupa_conversa,estado,no_atual_id,aguardando_ate,gatilho_tipo,gatilho_ref_id,gatilho_dedupe_key,is_test,marco_resposta_em)
    values(p_clinica,p_fluxo,p_versao,o.conversa_id,o.paciente_id,o.id,
      jsonb_build_object('eventoId',ev.id,'etapaId',o.estagio_id,'entradaEm',o.estagio_entrou_em,'status',o.status,'config',p_config,'cadeia',cadeia||to_jsonb(p_fluxo::text)),
      false,'queued',inicio,p_agendado,'kanban_stage_changed',p_evento,p_dedupe,p_teste,(ev.detalhe->>'occurred_at')::timestamptz)
    on conflict(fluxo_id,gatilho_dedupe_key) where gatilho_dedupe_key is not null do nothing returning id into nova;
  return jsonb_build_object('ok',true,'execucaoId',nova,'deduplicado',nova is null);
end $$;

-- Um claim tem token único. Nenhum caminho (inclusive o primeiro passo) executa sem claim.
create or replace function public.fluxo_reivindicar(p_clinica uuid,p_execucao uuid default null,p_resposta boolean default false,p_comerciais boolean default true)
returns jsonb language plpgsql set search_path=public as $$
declare e public.fluxo_execucoes%rowtype; anterior text;
begin
  select * into e from public.fluxo_execucoes where clinica_id=p_clinica and (p_execucao is null or id=p_execucao)
    and (p_comerciais or oportunidade_id is null)
    and ((p_resposta and estado='waiting_input') or (not p_resposta and estado in ('queued','waiting_time','waiting_input') and (aguardando_ate<=now() or (estado='queued' and aguardando_ate is null))))
    order by aguardando_ate nulls first,created_at,id for update skip locked limit 1;
  if not found then return null; end if;
  anterior:=e.estado;
  update public.fluxo_execucoes set estado='running',claim_token=gen_random_uuid(),claim_ate=now()+interval '2 minutes',passos_executados=passos_executados+1,updated_at=now()
    where id=e.id returning * into e;
  return jsonb_build_object('id',e.id,'token',e.claim_token,'sequencia',e.passos_executados,'entrada',case when p_resposta then 'resposta_texto' when anterior='waiting_input' then 'timeout' else 'avancar' end);
end $$;

-- Guarda final no banco. O commit desta autorização é o limite anterior ao envio externo.
create or replace function public.fluxo_autorizar_passo(p_clinica uuid,p_execucao uuid,p_token uuid,p_contato boolean,p_resposta boolean default false)
returns jsonb language plpgsql set search_path=public as $$
declare e public.fluxo_execucoes%rowtype; o public.oportunidades%rowtype; c public.conversas%rowtype; motivo text; capturando boolean;
begin
  select * into e from public.fluxo_execucoes where id=p_execucao and clinica_id=p_clinica;
  if not found then return jsonb_build_object('ok',false,'error','contexto_invalido'); end if;
  if e.oportunidade_id is not null then
    select * into o from public.oportunidades where id=e.oportunidade_id and clinica_id=p_clinica for update;
    if not found or o.paciente_id is distinct from e.paciente_id then motivo:='contexto_invalido'; end if;
  end if;
  if e.conversa_id is not null then
    select * into c from public.conversas where id=e.conversa_id and clinica_id=p_clinica for update;
    if not found or (e.paciente_id is not null and c.paciente_id is distinct from e.paciente_id) then motivo:='contexto_invalido'; end if;
  end if;
  select * into e from public.fluxo_execucoes where id=p_execucao and clinica_id=p_clinica and estado='running' and claim_token=p_token and claim_ate>now() for update;
  if not found then return jsonb_build_object('ok',false,'error','claim_perdido'); end if;
  if exists(select 1 from public.pacientes where id=e.paciente_id and clinica_id=p_clinica and opt_out_em is not null) then motivo:='opt_out'; end if;
  if e.oportunidade_id is not null then
    if o.status<>coalesce(e.contexto_comercial->>'status','open') and o.status<>'open' then motivo:='oportunidade_encerrada'; end if;
    if coalesce((e.contexto_comercial->'config'->>'pararAoSair')::boolean,true) and
      (o.estagio_id::text<>e.contexto_comercial->>'etapaId' or o.estagio_entrou_em is distinct from (e.contexto_comercial->>'entradaEm')::timestamptz) then motivo:='etapa_alterada'; end if;
    capturando:=p_resposta;
    if not capturando and coalesce((e.contexto_comercial->'config'->>'pararAoResponder')::boolean,true) and exists(
      select 1 from public.mensagens where clinica_id=p_clinica and conversa_id=e.conversa_id and direcao='recebida' and created_at>e.marco_resposta_em
    ) then motivo:='paciente_respondeu'; end if;
    if exists(select 1 from public.conversa_eventos where clinica_id=p_clinica and conversa_id=e.conversa_id and tipo='CONVERSATION_INTERVENED' and created_at>e.created_at) then motivo:='intervencao_humana'; end if;
    if exists(select 1 from public.mensagens where clinica_id=p_clinica and conversa_id=e.conversa_id and enviada_por_atendente_id is not null and created_at>e.marco_resposta_em) then motivo:='intervencao_humana'; end if;
    if p_contato and e.conversa_id is null then motivo:='contexto_invalido'; end if;
  end if;
  if motivo is not null then
    update public.fluxo_execucoes set estado='cancelled',motivo_finalizacao=motivo,finalizado_em=now(),updated_at=now(),claim_token=null,claim_ate=null where id=e.id;
    return jsonb_build_object('ok',false,'error',motivo);
  end if;
  if p_contato then
    if c.dono_conversa='agente_ia' or (c.fluxo_execucao_ativa_id is not null and c.fluxo_execucao_ativa_id<>e.id)
      or exists(select 1 from public.fluxo_execucoes where conversa_id=e.conversa_id and id<>e.id and ocupa_conversa and estado in ('queued','running','waiting_time','waiting_input')) then
      return jsonb_build_object('ok',false,'error','conversa_ocupada');
    end if;
    update public.fluxo_execucoes set ocupa_conversa=true where id=e.id;
    update public.conversas set dono_conversa='fluxo',fluxo_execucao_ativa_id=e.id,updated_at=now() where id=e.conversa_id and clinica_id=p_clinica;
  end if;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.fluxo_concluir_passo(p_clinica uuid,p_execucao uuid,p_token uuid,p_patch jsonb,p_resposta boolean default false)
returns boolean language plpgsql set search_path=public as $$
declare e public.fluxo_execucoes%rowtype; soltar boolean;
begin
  select * into e from public.fluxo_execucoes where id=p_execucao and clinica_id=p_clinica and estado='running' and claim_token=p_token for update;
  if not found then return false; end if;
  soltar:=e.oportunidade_id is not null and p_patch->>'estado'<>'waiting_input';
  update public.fluxo_execucoes set estado=p_patch->>'estado',no_atual_id=p_patch->>'no_atual_id',
    aguardando_ate=(p_patch->>'aguardando_ate')::timestamptz,variaveis=coalesce(p_patch->'variaveis',variaveis),
    motivo_finalizacao=p_patch->>'motivo_finalizacao',erro=p_patch->>'erro',updated_at=now(),
    finalizado_em=case when p_patch->>'estado' in ('completed','cancelled','failed','transferred') then now() else null end,
    ocupa_conversa=case when soltar then false else ocupa_conversa end,claim_token=null,claim_ate=null,
    marco_resposta_em=case when p_resposta then now() else marco_resposta_em end where id=e.id;
  if soltar then
    update public.conversas set fluxo_execucao_ativa_id=null,dono_conversa=case when dono_conversa='fluxo' then 'humano' else dono_conversa end,updated_at=now()
      where id=e.conversa_id and clinica_id=p_clinica and fluxo_execucao_ativa_id=e.id;
  end if;
  return true;
end $$;

-- Efeitos comerciais de banco + marca de idempotência na MESMA transação.
create or replace function public.fluxo_aplicar_acao_comercial(p_clinica uuid,p_execucao uuid,p_token uuid,p_acao jsonb)
returns jsonb language plpgsql set search_path=public as $$
declare e public.fluxo_execucoes%rowtype; o public.oportunidades%rowtype; r jsonb; valor text; acao text;
begin
  r:=public.fluxo_autorizar_passo(p_clinica,p_execucao,p_token,false,false);
  if not coalesce((r->>'ok')::boolean,false) then return r; end if;
  select * into e from public.fluxo_execucoes where id=p_execucao and clinica_id=p_clinica and oportunidade_id is not null;
  if not found then return jsonb_build_object('ok',false,'error','acao_exige_oportunidade'); end if;
  if exists(select 1 from public.fluxo_execucao_eventos where execucao_id=e.id and sequencia=e.passos_executados and payload->>'acao_concluida'='true') then
    return jsonb_build_object('ok',true,'deduplicado',true);
  end if;
  if not exists(select 1 from public.fluxo_execucao_eventos where execucao_id=e.id and sequencia=e.passos_executados and status='em_andamento') then
    return jsonb_build_object('ok',false,'error','passo_nao_registrado');
  end if;
  select * into o from public.oportunidades where id=e.oportunidade_id and clinica_id=p_clinica;
  acao:=p_acao->>'acao'; valor:=p_acao->>'valor';
  perform set_config('app.fluxo_causa',e.id::text,true);
  case acao
    when 'mover_oportunidade' then
      r:=public.mover_oportunidade(p_clinica,o.id,valor::uuid,o.versao,null,'automacao',nullif(p_acao->>'motivoPerdaId','')::uuid,null,'fluxo:'||e.id||':'||e.passos_executados);
    when 'responsavel' then
      r:=public.definir_responsavel_oportunidade(p_clinica,o.id,o.responsavel_id,nullif(valor,'')::uuid,null,'automacao');
    when 'interesse' then
      if length(trim(valor)) not between 1 and 120 then return jsonb_build_object('ok',false,'error','interesse_invalido'); end if;
      update public.oportunidades set interesse=trim(valor),updated_at=now() where id=o.id and clinica_id=p_clinica;
      r:=jsonb_build_object('ok',true);
    when 'nota' then
      if e.conversa_id is null or length(trim(valor)) not between 1 and 2000 then return jsonb_build_object('ok',false,'error','nota_invalida'); end if;
      insert into public.notas_internas(clinica_id,conversa_id,atendente_id,texto) values(p_clinica,e.conversa_id,null,trim(valor));
      r:=jsonb_build_object('ok',true);
    else return jsonb_build_object('ok',false,'error','acao_invalida');
  end case;
  if coalesce((r->>'ok')::boolean,false) then
    update public.fluxo_execucao_eventos set payload=payload||jsonb_build_object('acao_concluida',true),updated_at=now() where execucao_id=e.id and sequencia=e.passos_executados;
  end if;
  return r;
end $$;

create or replace function public.fluxo_publicar(p_clinica uuid,p_fluxo uuid,p_versao uuid,p_ator uuid,p_definicao jsonb) returns boolean language plpgsql set search_path=public as $$
declare v public.fluxo_versoes%rowtype;
begin
  perform 1 from public.fluxos where id=p_fluxo and clinica_id=p_clinica for update;
  if not found then return false; end if;
  select * into v from public.fluxo_versoes where id=p_versao and fluxo_id=p_fluxo and clinica_id=p_clinica and status='rascunho' for update;
  if not found or v.definicao<>p_definicao then return false; end if;
  update public.fluxo_versoes set status='substituida',updated_at=now() where fluxo_id=p_fluxo and clinica_id=p_clinica and status='publicada';
  update public.fluxo_versoes set status='publicada',publicado_por=p_ator,publicado_em=now(),updated_at=now() where id=v.id;
  update public.fluxos set gatilho_tipo=v.definicao->'config'->'gatilho'->>'tipo',gatilho_config=coalesce(v.definicao->'config'->'gatilho'->'config','{}'::jsonb),updated_at=now() where id=p_fluxo;
  return true;
end $$;

create or replace function public.fluxo_alterar_status(p_clinica uuid,p_fluxo uuid,p_status text,p_ator uuid,p_interromper boolean default false)
returns jsonb language plpgsql set search_path=public as $$
begin
  if p_status not in ('ativo','pausado','arquivado') then return jsonb_build_object('ok',false,'error','status_invalido'); end if;
  perform 1 from public.fluxos where id=p_fluxo and clinica_id=p_clinica for update;
  if not found then return jsonb_build_object('ok',false,'error','not_found'); end if;
  if p_status='ativo' and not exists(select 1 from public.fluxo_versoes where fluxo_id=p_fluxo and clinica_id=p_clinica and status='publicada') then
    return jsonb_build_object('ok',false,'error','sem_versao_publicada');
  end if;
  update public.fluxos set status=p_status,updated_at=now(),pausado_por=case when p_status='pausado' then p_ator else null end,
    pausado_em=case when p_status='pausado' then now() else null end,arquivado_por=case when p_status='arquivado' then p_ator else null end,
    arquivado_em=case when p_status='arquivado' then now() else null end where id=p_fluxo;
  if p_interromper then
    update public.fluxo_execucoes set estado='cancelled',motivo_finalizacao='interrompida_manualmente',finalizado_em=now(),updated_at=now(),claim_token=null,claim_ate=null
      where fluxo_id=p_fluxo and clinica_id=p_clinica and estado in ('queued','running','waiting_time','waiting_input');
  end if;
  return jsonb_build_object('ok',true,'id',p_fluxo);
end $$;

create or replace function public.fluxo_versao_imutavel() returns trigger language plpgsql set search_path=public as $$
begin
  if old.status<>'rascunho' and old.definicao is distinct from new.definicao then raise exception 'versao_imutavel' using errcode='23514'; end if;
  return new;
end $$;
create trigger fluxo_versao_imutavel before update on public.fluxo_versoes for each row execute function public.fluxo_versao_imutavel();

-- RPCs são backend-only; service_role não substitui validação da clínica.
do $$ declare r record; begin
  for r in select oid::regprocedure assinatura from pg_proc where pronamespace='public'::regnamespace
    and proname in ('fluxo_proteger_execucao','fluxo_liberar_encerrada','fluxo_evento_kanban','fluxo_resposta_comercial','fluxo_intervencao_comercial',
      'fluxo_reivindicar_evento','fluxo_iniciar_comercial','fluxo_reivindicar','fluxo_autorizar_passo','fluxo_concluir_passo','fluxo_aplicar_acao_comercial','fluxo_publicar','fluxo_alterar_status','fluxo_versao_imutavel')
  loop execute format('revoke all on function %s from public, anon, authenticated',r.assinatura);
       execute format('grant execute on function %s to service_role',r.assinatura); end loop;
end $$;
commit;
