-- ============================================================================
-- CRM OdontoMinas — V30: canais de atendimento + caixa compartilhada
-- Data: 2026-09-19
--
-- Fase "Canais WhatsApp + Caixa Compartilhada Multiatendente". 100% ADITIVA:
-- o código antigo continua funcionando com esta migration aplicada (o trigger
-- `conversas_preencher_canal` garante `canal_id` em toda conversa criada por
-- código que ainda não conhece canais). A remoção do UNIQUE antigo
-- (clinica_id, telefone) e o NOT NULL de `canal_id` ficam na v31, aplicada
-- só depois do deploy e da verificação.
--
-- Princípio: número WhatsApp ≠ atendente. O número (canal) pertence à
-- clínica; `tipo`/`provider` são texto livre de propósito (sem CHECK) pra
-- aceitar instagram/webchat/etc. sem migration. Segredo NUNCA fica aqui:
-- `credencial_ref` é só o NOME da env var que guarda o token do canal.
--
-- Concorrência: assumir/transferir/desatribuir são funções Postgres com
-- UPDATE condicional (`atribuido_a IS NULL` / `IS NOT DISTINCT FROM esperado`)
-- + evento gravado na MESMA transação — last-write-wins silencioso é
-- impossível por construção.
--
-- Rodar depois da v29. Grants no mesmo arquivo (schema public sem default
-- privileges, mesmo cuidado de v5/v6/v25).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. canais
-- ---------------------------------------------------------------------------
create table if not exists public.canais (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nome text not null,
  tipo text not null default 'whatsapp',
  provider text not null default 'evolution',
  provider_instance_id text not null,
  telefone text,
  identificador_externo text,
  -- Só a conexão com o provider (pausa administrativa é `ativo = false`).
  status text not null default 'unknown'
    check (status in ('connected', 'disconnected', 'connecting', 'error', 'unknown')),
  ativo boolean not null default true,
  principal boolean not null default false,
  -- Nome da env var com o token deste canal (nunca o valor). null = usa o
  -- token global da integração.
  credencial_ref text,
  configuracao jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_webhook_at timestamptz,
  last_message_in_at timestamptz,
  last_message_out_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_instance_id)
);

create unique index if not exists canais_principal_unq on public.canais (clinica_id) where principal;
create index if not exists canais_clinica_idx on public.canais (clinica_id);

alter table public.canais enable row level security;
grant select, insert, update, delete on public.canais to service_role;

-- ---------------------------------------------------------------------------
-- 2. conversas: canal, responsável desde quando, finalização
-- ---------------------------------------------------------------------------
alter table public.conversas add column if not exists canal_id uuid references public.canais (id) on delete restrict;
alter table public.conversas add column if not exists atribuido_em timestamptz;
-- "Finalizada" (atendimento encerrado pelo humano) — o status `respondido` faz
-- dois papéis (aguardando paciente / finalizada), este campo é o desempate.
-- Limpo quando o paciente escreve de novo (webhook).
alter table public.conversas add column if not exists finalizada_em timestamptz;

create index if not exists conversas_canal_idx on public.conversas (clinica_id, canal_id);
create index if not exists conversas_sem_responsavel_idx on public.conversas (clinica_id) where atribuido_a is null;

-- ---------------------------------------------------------------------------
-- 3. Canal inicial (backfill) — a instância que já atende hoje
-- ---------------------------------------------------------------------------
-- Instância = a mais usada em conversas.instancia_evolution (evidência do
-- webhook real). Clínica sem instância conhecida NÃO ganha canal aqui: o app
-- cria o principal a partir do env no primeiro uso (garantirCanalPrincipal).
insert into public.canais (clinica_id, nome, provider_instance_id, principal)
select c.id,
       coalesce(nullif(trim(c.apelido_instancia), ''), 'WhatsApp Principal'),
       i.instancia,
       true
from public.clinicas c
join lateral (
  select instancia_evolution as instancia
  from public.conversas
  where clinica_id = c.id and instancia_evolution is not null
  group by instancia_evolution
  order by count(*) desc
  limit 1
) i on true
where not exists (select 1 from public.canais x where x.clinica_id = c.id)
on conflict do nothing;

update public.conversas v
set canal_id = (select id from public.canais where clinica_id = v.clinica_id and principal limit 1)
where v.canal_id is null;

-- ---------------------------------------------------------------------------
-- 4. Trigger: código que ainda não conhece canais continua criando conversa válida
-- ---------------------------------------------------------------------------
create or replace function public.conversas_preencher_canal() returns trigger
language plpgsql as $$
begin
  if new.canal_id is null then
    select id into new.canal_id
    from public.canais
    where clinica_id = new.clinica_id
      and (provider_instance_id = new.instancia_evolution or principal)
    order by coalesce(provider_instance_id = new.instancia_evolution, false) desc, principal desc
    limit 1;
  end if;
  return new;
end $$;

drop trigger if exists conversas_preencher_canal_trg on public.conversas;
create trigger conversas_preencher_canal_trg
  before insert on public.conversas
  for each row execute function public.conversas_preencher_canal();

-- Unicidade nova (a antiga só cai na v31): por canal.
create unique index if not exists conversas_clinica_canal_telefone_unq
  on public.conversas (clinica_id, canal_id, telefone);

-- ---------------------------------------------------------------------------
-- 5. Histórico operacional da conversa
-- ---------------------------------------------------------------------------
create table if not exists public.conversa_eventos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  canal_id uuid references public.canais (id) on delete set null,
  tipo text not null,
  ator_id uuid references public.atendentes (id) on delete set null,
  de_atendente_id uuid references public.atendentes (id) on delete set null,
  para_atendente_id uuid references public.atendentes (id) on delete set null,
  motivo text,
  created_at timestamptz not null default now()
);

create index if not exists conversa_eventos_conversa_idx on public.conversa_eventos (conversa_id, created_at desc);
create index if not exists conversa_eventos_clinica_idx on public.conversa_eventos (clinica_id, created_at desc);

alter table public.conversa_eventos enable row level security;
grant select, insert, update, delete on public.conversa_eventos to service_role;

-- ---------------------------------------------------------------------------
-- 6. Assumir / transferir / desatribuir (atômicos)
-- ---------------------------------------------------------------------------
create or replace function public.assumir_conversa(p_clinica uuid, p_conversa uuid, p_ator uuid)
returns jsonb language plpgsql as $$
declare
  v_canal uuid;
  v_atual uuid;
  v_nome text;
begin
  update public.conversas
  set atribuido_a = p_ator, atribuido_em = now(), updated_at = now()
  where id = p_conversa and clinica_id = p_clinica and atribuido_a is null
  returning canal_id into v_canal;

  if found then
    insert into public.conversa_eventos (clinica_id, conversa_id, canal_id, tipo, ator_id, para_atendente_id)
    values (p_clinica, p_conversa, v_canal, 'CONVERSATION_ASSIGNED', p_ator, p_ator);
    return jsonb_build_object('ok', true);
  end if;

  select c.atribuido_a, a.nome into v_atual, v_nome
  from public.conversas c left join public.atendentes a on a.id = c.atribuido_a
  where c.id = p_conversa and c.clinica_id = p_clinica;

  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_atual = p_ator then return jsonb_build_object('ok', true, 'ja_era_sua', true); end if;
  return jsonb_build_object('ok', false, 'error', 'ja_assumida', 'por_id', v_atual, 'por_nome', v_nome);
end $$;

-- p_esperado = responsável que quem chamou VIU (null = viu sem responsável).
-- p_forcar = true só pra automação/sistema (ação de Fluxo), que não tem "visão".
create or replace function public.transferir_conversa(
  p_clinica uuid, p_conversa uuid, p_ator uuid, p_esperado uuid, p_destino uuid,
  p_motivo text default null, p_forcar boolean default false
) returns jsonb language plpgsql as $$
declare
  v_canal uuid;
  v_atual uuid;
  v_nome text;
begin
  if not exists (
    select 1 from public.atendentes
    where id = p_destino and clinica_id = p_clinica and status = 'active'
  ) then
    return jsonb_build_object('ok', false, 'error', 'destino_invalido');
  end if;

  update public.conversas
  set atribuido_a = p_destino, atribuido_em = now(), updated_at = now()
  where id = p_conversa and clinica_id = p_clinica
    and (p_forcar or atribuido_a is not distinct from p_esperado)
  returning canal_id into v_canal;

  if found then
    insert into public.conversa_eventos (clinica_id, conversa_id, canal_id, tipo, ator_id, de_atendente_id, para_atendente_id, motivo)
    values (p_clinica, p_conversa, v_canal,
            case when p_esperado is null then 'CONVERSATION_ASSIGNED' else 'CONVERSATION_TRANSFERRED' end,
            p_ator, p_esperado, p_destino, p_motivo);
    return jsonb_build_object('ok', true);
  end if;

  select c.atribuido_a, a.nome into v_atual, v_nome
  from public.conversas c left join public.atendentes a on a.id = c.atribuido_a
  where c.id = p_conversa and c.clinica_id = p_clinica;

  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', false, 'error', 'conflito', 'por_id', v_atual, 'por_nome', v_nome);
end $$;

create or replace function public.desatribuir_conversa(
  p_clinica uuid, p_conversa uuid, p_ator uuid, p_esperado uuid, p_motivo text default null
) returns jsonb language plpgsql as $$
declare
  v_canal uuid;
  v_atual uuid;
  v_nome text;
begin
  update public.conversas
  set atribuido_a = null, atribuido_em = null, updated_at = now()
  where id = p_conversa and clinica_id = p_clinica
    and atribuido_a is not null and atribuido_a is not distinct from p_esperado
  returning canal_id into v_canal;

  if found then
    insert into public.conversa_eventos (clinica_id, conversa_id, canal_id, tipo, ator_id, de_atendente_id, motivo)
    values (p_clinica, p_conversa, v_canal, 'CONVERSATION_UNASSIGNED', p_ator, p_esperado, p_motivo);
    return jsonb_build_object('ok', true);
  end if;

  select c.atribuido_a, a.nome into v_atual, v_nome
  from public.conversas c left join public.atendentes a on a.id = c.atribuido_a
  where c.id = p_conversa and c.clinica_id = p_clinica;

  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', false, 'error', 'conflito', 'por_id', v_atual, 'por_nome', v_nome);
end $$;

grant execute on function public.assumir_conversa(uuid, uuid, uuid) to service_role;
grant execute on function public.transferir_conversa(uuid, uuid, uuid, uuid, uuid, text, boolean) to service_role;
grant execute on function public.desatribuir_conversa(uuid, uuid, uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Última mensagem por conversa (a lista do Chat lia TODAS as mensagens)
-- ---------------------------------------------------------------------------
create index if not exists mensagens_conversa_created_idx on public.mensagens (conversa_id, created_at desc);

create or replace function public.conversas_ultima_mensagem(p_clinica uuid)
returns table (conversa_id uuid, direcao text, tipo text, conteudo text)
language sql stable as $$
  select distinct on (m.conversa_id) m.conversa_id, m.direcao, m.tipo, m.conteudo
  from public.mensagens m
  where m.clinica_id = p_clinica
  order by m.conversa_id, m.created_at desc
$$;

grant execute on function public.conversas_ultima_mensagem(uuid) to service_role;

-- Verificação rápida (opcional):
--   select nome, provider_instance_id, principal from public.canais;
--   select count(*) filter (where canal_id is null) as sem_canal, count(*) as total from public.conversas;
