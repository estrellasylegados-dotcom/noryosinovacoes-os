-- ============================================================================
-- CRM OdontoMinas — V33: Kanban comercial (pipelines, estágios, oportunidades)
-- Data: 2026-09-18
--
-- 100% ADITIVA: só cria tabelas/funções novas. Nenhuma tabela existente é
-- alterada; Chat, conversas e pacientes não dependem de nada daqui.
--
-- Modelo: PACIENTE -> OPORTUNIDADE -> PIPELINE -> ESTÁGIO.
--  - estágio (kanban) != tag (etiquetas, já existentes) != status da conversa.
--  - `oportunidades.versao` = concorrência otimista do ESTÁGIO (move com
--    versão esperada; quem chegou com estado velho recebe 'conflito').
--  - histórico = negócio (oportunidade_historico); auditoria_eventos (já
--    existente) = quem fez o quê, escrita pela aplicação.
--
-- ROLLBACK (nada depende disto): ao final do arquivo.
-- ============================================================================

-- 1. Pipelines ---------------------------------------------------------------
create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nome text not null,
  padrao boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists pipelines_padrao_unq on public.pipelines (clinica_id) where padrao;

-- 2. Estágios ----------------------------------------------------------------
create table if not exists public.pipeline_estagios (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  nome text not null,
  ordem integer not null,
  tipo text not null default 'open' check (tipo in ('open', 'won', 'lost')),
  cor text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists pipeline_estagios_pipeline_idx on public.pipeline_estagios (pipeline_id, ordem);

-- 3. Motivos de perda (estruturado, customizável no futuro) -------------------
create table if not exists public.motivos_perda (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists motivos_perda_nome_unq on public.motivos_perda (clinica_id, lower(nome));

-- 4. Oportunidades -----------------------------------------------------------
create table if not exists public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  paciente_id uuid not null references public.pacientes (id) on delete cascade,
  pipeline_id uuid not null references public.pipelines (id),
  estagio_id uuid not null references public.pipeline_estagios (id),
  responsavel_id uuid references public.atendentes (id) on delete set null,
  conversa_id uuid references public.conversas (id) on delete set null,
  interesse text,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  versao integer not null default 1,
  estagio_entrou_em timestamptz not null default now(),
  motivo_perda_id uuid references public.motivos_perda (id),
  motivo_perda_obs text,
  converted_at timestamptz,
  lost_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Dedupe da 1ª versão: no máximo 1 oportunidade ABERTA por paciente + pipeline
-- (várias históricas/ganhas/perdidas continuam permitidas -> multi-oportunidade futura).
create unique index if not exists oportunidades_aberta_unq on public.oportunidades (paciente_id, pipeline_id) where status = 'open';
create index if not exists oportunidades_board_idx on public.oportunidades (clinica_id, pipeline_id, estagio_id);
create index if not exists oportunidades_responsavel_idx on public.oportunidades (clinica_id, responsavel_id);
create index if not exists oportunidades_conversa_idx on public.oportunidades (conversa_id);

-- 5. Histórico de negócio ------------------------------------------------------
create table if not exists public.oportunidade_historico (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  oportunidade_id uuid not null references public.oportunidades (id) on delete cascade,
  tipo text not null check (tipo in ('created', 'stage_changed', 'owner_changed')),
  estagio_de uuid references public.pipeline_estagios (id),
  estagio_para uuid references public.pipeline_estagios (id),
  responsavel_de uuid references public.atendentes (id) on delete set null,
  responsavel_para uuid references public.atendentes (id) on delete set null,
  motivo_perda_id uuid references public.motivos_perda (id),
  observacao text,
  ator_id uuid references public.atendentes (id) on delete set null,
  origem text not null default 'manual' check (origem in ('manual', 'automacao', 'api', 'controle_odonto', 'sistema')),
  idempotency_key text,
  created_at timestamptz not null default now()
);
create unique index if not exists oportunidade_historico_idem_unq on public.oportunidade_historico (oportunidade_id, idempotency_key) where idempotency_key is not null;
create index if not exists oportunidade_historico_opp_idx on public.oportunidade_historico (oportunidade_id, created_at desc);
create index if not exists oportunidade_historico_clinica_idx on public.oportunidade_historico (clinica_id, created_at desc);

alter table public.pipelines enable row level security;
alter table public.pipeline_estagios enable row level security;
alter table public.motivos_perda enable row level security;
alter table public.oportunidades enable row level security;
alter table public.oportunidade_historico enable row level security;
grant select, insert, update, delete on public.pipelines to service_role;
grant select, insert, update, delete on public.pipeline_estagios to service_role;
grant select, insert, update, delete on public.motivos_perda to service_role;
grant select, insert, update, delete on public.oportunidades to service_role;
grant select, insert, update, delete on public.oportunidade_historico to service_role;

-- 6. Seed idempotente por clínica ---------------------------------------------
create or replace function public.garantir_pipeline_padrao(p_clinica uuid)
returns uuid language plpgsql set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from public.pipelines where clinica_id = p_clinica and padrao;
  if v_id is null then
    insert into public.pipelines (clinica_id, nome, padrao) values (p_clinica, 'Comercial', true)
    on conflict (clinica_id) where padrao do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.pipelines where clinica_id = p_clinica and padrao;
    else
      insert into public.pipeline_estagios (clinica_id, pipeline_id, nome, ordem, tipo, cor) values
        (p_clinica, v_id, 'Novo', 1, 'open', '#dc2626'),
        (p_clinica, v_id, 'Em atendimento', 2, 'open', '#d97706'),
        (p_clinica, v_id, 'Qualificado', 3, 'open', '#2563eb'),
        (p_clinica, v_id, 'Agendado', 4, 'open', '#0d9488'),
        (p_clinica, v_id, 'Follow-up', 5, 'open', '#7c3aed'),
        (p_clinica, v_id, 'Convertido', 6, 'won', '#059669'),
        (p_clinica, v_id, 'Perdido', 7, 'lost', '#6b7280');
    end if;
  end if;

  insert into public.motivos_perda (clinica_id, nome, ordem)
  select p_clinica, m.nome, m.ordem
  from (values ('Preço', 1), ('Sem resposta', 2), ('Concorrente', 3), ('Desistiu', 4),
               ('Fora da região', 5), ('Tratamento não indicado', 6), ('Outro', 7)) as m(nome, ordem)
  where not exists (select 1 from public.motivos_perda where clinica_id = p_clinica);

  return v_id;
end $$;

select public.garantir_pipeline_padrao(id) from public.clinicas;

-- 7. Criar oportunidade (idempotente, sem duplicar) ------------------------------
-- p_reabrir_ciclo=true: cria se não há aberta (conversa nova). false: só cria se o
-- paciente NUNCA teve oportunidade (mensagem de conversa antiga não reabre lead ganho/perdido).
create or replace function public.criar_oportunidade(
  p_clinica uuid, p_paciente uuid, p_conversa uuid, p_ator uuid, p_origem text default 'sistema',
  p_interesse text default null, p_reabrir_ciclo boolean default true
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_pipeline uuid;
  v_estagio uuid;
  v_resp uuid;
  v_id uuid;
begin
  if not exists (select 1 from public.pacientes where id = p_paciente and clinica_id = p_clinica) then
    return jsonb_build_object('ok', false, 'error', 'paciente_nao_encontrado');
  end if;

  v_pipeline := public.garantir_pipeline_padrao(p_clinica);

  if exists (select 1 from public.oportunidades where paciente_id = p_paciente and pipeline_id = v_pipeline and status = 'open') then
    return jsonb_build_object('ok', true, 'criada', false, 'motivo', 'ja_existe_aberta');
  end if;
  if not p_reabrir_ciclo and exists (select 1 from public.oportunidades where paciente_id = p_paciente and pipeline_id = v_pipeline) then
    return jsonb_build_object('ok', true, 'criada', false, 'motivo', 'ja_teve_oportunidade');
  end if;

  select id into v_estagio from public.pipeline_estagios
   where pipeline_id = v_pipeline and ativo and tipo = 'open' order by ordem limit 1;
  if v_estagio is null then return jsonb_build_object('ok', false, 'error', 'pipeline_sem_estagio'); end if;

  if p_conversa is not null then
    select atribuido_a into v_resp from public.conversas where id = p_conversa and clinica_id = p_clinica;
    if not found then p_conversa := null; end if;
  end if;

  insert into public.oportunidades (clinica_id, paciente_id, pipeline_id, estagio_id, responsavel_id, conversa_id, interesse)
  values (p_clinica, p_paciente, v_pipeline, v_estagio, v_resp, p_conversa, nullif(trim(p_interesse), ''))
  on conflict (paciente_id, pipeline_id) where status = 'open' do nothing
  returning id into v_id;

  if v_id is null then return jsonb_build_object('ok', true, 'criada', false, 'motivo', 'ja_existe_aberta'); end if;

  insert into public.oportunidade_historico (clinica_id, oportunidade_id, tipo, estagio_para, responsavel_para, ator_id, origem, idempotency_key)
  values (p_clinica, v_id, 'created', v_estagio, v_resp, p_ator, p_origem, 'created');

  return jsonb_build_object('ok', true, 'criada', true, 'oportunidade_id', v_id, 'estagio_id', v_estagio);
end $$;

-- 8. Mover de estágio (atômico: conditional update + histórico na mesma transação) --
create or replace function public.mover_oportunidade(
  p_clinica uuid, p_oportunidade uuid, p_estagio uuid, p_versao_esperada integer, p_ator uuid,
  p_origem text default 'manual', p_motivo_perda uuid default null, p_observacao text default null,
  p_idem_key text default null
) returns jsonb language plpgsql set search_path = public as $$
declare
  o public.oportunidades%rowtype;
  v_dest public.pipeline_estagios%rowtype;
  v_anterior uuid;
  v_status text;
  v_hist uuid;
begin
  select * into o from public.oportunidades where id = p_oportunidade and clinica_id = p_clinica;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  v_anterior := o.estagio_id;

  -- retry da mesma operação: não duplica histórico
  if p_idem_key is not null and exists (
    select 1 from public.oportunidade_historico where oportunidade_id = p_oportunidade and idempotency_key = p_idem_key
  ) then
    return jsonb_build_object('ok', true, 'idempotente', true, 'versao', o.versao, 'estagio_id', o.estagio_id, 'status', o.status);
  end if;

  select * into v_dest from public.pipeline_estagios
   where id = p_estagio and clinica_id = p_clinica and pipeline_id = o.pipeline_id and ativo;
  if not found then return jsonb_build_object('ok', false, 'error', 'estagio_invalido'); end if;

  if v_dest.tipo = 'lost' and (p_motivo_perda is null or not exists (
    select 1 from public.motivos_perda where id = p_motivo_perda and clinica_id = p_clinica and ativo
  )) then
    return jsonb_build_object('ok', false, 'error', 'motivo_obrigatorio');
  end if;

  v_status := case v_dest.tipo when 'won' then 'won' when 'lost' then 'lost' else 'open' end;

  begin
    update public.oportunidades set
      estagio_id = v_dest.id,
      status = v_status,
      versao = versao + 1,
      estagio_entrou_em = now(),
      updated_at = now(),
      converted_at = case when v_status = 'won' then now() else null end,
      lost_at = case when v_status = 'lost' then now() else null end,
      motivo_perda_id = case when v_status = 'lost' then p_motivo_perda else null end,
      motivo_perda_obs = case when v_status = 'lost' then nullif(trim(p_observacao), '') else null end
    where id = p_oportunidade and clinica_id = p_clinica and versao = p_versao_esperada and estagio_id <> v_dest.id
    returning * into o;
  exception when unique_violation then
    -- reabrir um card ganho/perdido quando o paciente já tem outra oportunidade aberta no pipeline
    return jsonb_build_object('ok', false, 'error', 'ja_existe_aberta');
  end;

  if not found then
    select * into o from public.oportunidades where id = p_oportunidade and clinica_id = p_clinica;
    if o.estagio_id = v_dest.id and o.versao = p_versao_esperada then
      return jsonb_build_object('ok', true, 'sem_mudanca', true, 'versao', o.versao);
    end if;
    return jsonb_build_object('ok', false, 'error', 'conflito', 'versao_atual', o.versao, 'estagio_atual', o.estagio_id);
  end if;

  insert into public.oportunidade_historico
    (clinica_id, oportunidade_id, tipo, estagio_de, estagio_para, motivo_perda_id, observacao, ator_id, origem, idempotency_key)
  values
    (p_clinica, p_oportunidade, 'stage_changed', v_anterior, v_dest.id,
     case when v_status = 'lost' then p_motivo_perda end, nullif(trim(p_observacao), ''), p_ator, p_origem, p_idem_key)
  returning id into v_hist;

  return jsonb_build_object('ok', true, 'historico_id', v_hist, 'estagio_de', v_anterior, 'estagio_id', o.estagio_id,
                            'versao', o.versao, 'status', o.status, 'paciente_id', o.paciente_id, 'pipeline_id', o.pipeline_id);
end $$;

-- 9. Responsável da oportunidade acompanha a conversa (regra da 1ª versão) --------
-- assumir:    p_de = null     -> só oportunidades abertas SEM responsável recebem p_para.
-- transferir: p_de = anterior -> só as que eram do responsável anterior vão junto; as demais ficam.
-- Não mexe em `versao` (a versão protege o ESTÁGIO; trocar o dono não invalida uma decisão de estágio).
create or replace function public.sincronizar_responsavel_oportunidade(
  p_clinica uuid, p_conversa uuid, p_de uuid, p_para uuid, p_ator uuid, p_origem text default 'sistema'
) returns integer language plpgsql set search_path = public as $$
declare
  v_n integer := 0;
  r record;
begin
  for r in
    update public.oportunidades set responsavel_id = p_para, updated_at = now()
    where clinica_id = p_clinica and conversa_id = p_conversa and status = 'open'
      and responsavel_id is not distinct from p_de and responsavel_id is distinct from p_para
    returning id
  loop
    insert into public.oportunidade_historico (clinica_id, oportunidade_id, tipo, responsavel_de, responsavel_para, ator_id, origem)
    values (p_clinica, r.id, 'owner_changed', p_de, p_para, p_ator, p_origem);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

grant execute on function public.garantir_pipeline_padrao(uuid) to service_role;
grant execute on function public.criar_oportunidade(uuid, uuid, uuid, uuid, text, text, boolean) to service_role;
grant execute on function public.mover_oportunidade(uuid, uuid, uuid, integer, uuid, text, uuid, text, text) to service_role;
grant execute on function public.sincronizar_responsavel_oportunidade(uuid, uuid, uuid, uuid, uuid, text) to service_role;

-- 10. Backfill seguro: só conversas ABERTAS com paciente, 1 por paciente ---------
-- (histórico finalizado/arquivado e conversas sem paciente NÃO viram oportunidade).
-- Contagem conferida antes: 11 conversas abertas com paciente, 10 pacientes -> 10 oportunidades.
-- Idempotente (criar_oportunidade não duplica).
select public.criar_oportunidade(c.clinica_id, c.paciente_id, c.id, null, 'sistema', null, true)
from (
  select distinct on (paciente_id) clinica_id, paciente_id, id
  from public.conversas
  where paciente_id is not null and finalizada_em is null and not arquivada
  order by paciente_id, ultima_mensagem_em desc nulls last
) c;

-- ---------------------------------------------------------------------------
-- ROLLBACK (só o Kanban some; Chat/conversas/pacientes seguem intactos):
--   drop function if exists public.sincronizar_responsavel_oportunidade(uuid, uuid, uuid, uuid, uuid, text);
--   drop function if exists public.mover_oportunidade(uuid, uuid, uuid, integer, uuid, text, uuid, text, text);
--   drop function if exists public.criar_oportunidade(uuid, uuid, uuid, uuid, text, text, boolean);
--   drop function if exists public.garantir_pipeline_padrao(uuid);
--   drop table if exists public.oportunidade_historico, public.oportunidades, public.motivos_perda,
--                        public.pipeline_estagios, public.pipelines;
-- ---------------------------------------------------------------------------
