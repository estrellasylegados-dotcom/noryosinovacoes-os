-- ============================================================================
-- CRM OdontoMinas — V38: distribuicao automatica de atendimentos (V1)
-- Data: 2026-09-20
--
-- Aditiva. Usa o ownership existente (`conversas.atribuido_a`) e o historico
-- existente (`conversa_eventos`). A RPC serializa por clinica com FOR UPDATE no
-- config, escolhe round-robin persistente e so atualiza conversa sem responsavel.
-- ============================================================================

create table if not exists public.atendimento_config (
  clinica_id uuid primary key references public.clinicas (id) on delete cascade,
  auto_distribuicao_ativa boolean not null default false,
  auto_distribuicao_estrategia text not null default 'round_robin'
    check (auto_distribuicao_estrategia in ('round_robin')),
  auto_distribuicao_ultimo_atendente_id uuid references public.atendentes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.atendimento_config enable row level security;
grant select, insert, update, delete on public.atendimento_config to service_role;

create or replace function public.auto_distribuir_conversa_round_robin(p_clinica uuid, p_conversa uuid)
returns jsonb language plpgsql as $$
declare
  v_config public.atendimento_config%rowtype;
  v_conversa record;
  v_destino uuid;
  v_canal uuid;
begin
  insert into public.atendimento_config (clinica_id)
  values (p_clinica)
  on conflict (clinica_id) do nothing;

  select * into v_config
  from public.atendimento_config
  where clinica_id = p_clinica
  for update;

  if not found or not v_config.auto_distribuicao_ativa then
    return jsonb_build_object('ok', true, 'assigned', false, 'reason', 'disabled');
  end if;

  select id, canal_id, atribuido_a into v_conversa
  from public.conversas
  where id = p_conversa and clinica_id = p_clinica
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_conversa.atribuido_a is not null then
    return jsonb_build_object('ok', true, 'assigned', false, 'reason', 'already_assigned', 'atendente_id', v_conversa.atribuido_a);
  end if;

  with elegiveis as (
    select a.id, row_number() over (order by a.nome, a.id) as rn
    from public.atendentes a
    where a.clinica_id = p_clinica
      and a.status = 'active'
      and coalesce(a.ativo, true) = true
      and a.perfil not in ('noryos_admin', 'noryos_suporte')
      and (
        (a.permissoes_customizadas is null and a.perfil in ('dona', 'gerente', 'supervisora', 'atendente'))
        or (a.permissoes_customizadas is not null and a.permissoes_customizadas ? 'conversas.assumir')
      )
  ),
  marcador as (
    select coalesce((select rn from elegiveis where id = v_config.auto_distribuicao_ultimo_atendente_id), 0) as rn
  )
  select id into v_destino
  from elegiveis, marcador
  where elegiveis.rn > marcador.rn
  order by elegiveis.rn
  limit 1;

  if v_destino is null then
    select id into v_destino from (
      select a.id
      from public.atendentes a
      where a.clinica_id = p_clinica
        and a.status = 'active'
        and coalesce(a.ativo, true) = true
        and a.perfil not in ('noryos_admin', 'noryos_suporte')
        and (
          (a.permissoes_customizadas is null and a.perfil in ('dona', 'gerente', 'supervisora', 'atendente'))
          or (a.permissoes_customizadas is not null and a.permissoes_customizadas ? 'conversas.assumir')
        )
      order by a.nome, a.id
      limit 1
    ) x;
  end if;

  if v_destino is null then
    return jsonb_build_object('ok', true, 'assigned', false, 'reason', 'no_eligible');
  end if;

  update public.conversas
  set atribuido_a = v_destino, atribuido_em = now(), updated_at = now()
  where id = p_conversa and clinica_id = p_clinica and atribuido_a is null
  returning canal_id into v_canal;

  if not found then
    return jsonb_build_object('ok', true, 'assigned', false, 'reason', 'concurrent_assignment');
  end if;

  update public.atendimento_config
  set auto_distribuicao_ultimo_atendente_id = v_destino, updated_at = now()
  where clinica_id = p_clinica;

  insert into public.conversa_eventos (clinica_id, conversa_id, canal_id, tipo, ator_id, para_atendente_id, motivo)
  values (p_clinica, p_conversa, v_canal, 'CONVERSATION_ASSIGNED', null, v_destino, 'automatic_distribution');

  return jsonb_build_object('ok', true, 'assigned', true, 'atendente_id', v_destino);
end $$;

grant execute on function public.auto_distribuir_conversa_round_robin(uuid, uuid) to service_role;
