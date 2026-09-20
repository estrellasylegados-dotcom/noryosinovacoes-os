-- ============================================================================
-- CRM OdontoMinas - V37: Noryos Ops (central interna de operacoes)
-- Data: 2026-09-20
--
-- Migration aditiva. Reaproveita alertas, canais, auditoria, automacao_eventos
-- e integration_sync_log/state; cria apenas o que nao existia como fonte
-- persistida confiavel: erros tecnicos, incidentes, heartbeats e deploys.
-- ============================================================================

create table if not exists public.ops_erros (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid references public.clinicas (id) on delete set null,
  servico text not null,
  categoria text not null default 'sistema',
  severidade text not null default 'erro' check (severidade in ('info', 'aviso', 'erro', 'critico')),
  mensagem_segura text not null,
  correlation_id text,
  status text not null default 'aberto' check (status in ('aberto', 'associado', 'resolvido', 'ignorado')),
  origem text,
  metadata jsonb not null default '{}'::jsonb,
  primeiro_em timestamptz not null default now(),
  ultimo_em timestamptz not null default now(),
  ocorrencias int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ops_erros_status_idx on public.ops_erros (status, ultimo_em desc);
create index if not exists ops_erros_clinica_idx on public.ops_erros (clinica_id, ultimo_em desc);
create index if not exists ops_erros_correlation_idx on public.ops_erros (correlation_id) where correlation_id is not null;

create table if not exists public.ops_incidentes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  severidade text not null default 'media' check (severidade in ('baixa', 'media', 'alta', 'critica')),
  status text not null default 'aberto' check (status in ('aberto', 'investigando', 'resolvido')),
  clinica_id uuid references public.clinicas (id) on delete set null,
  origem text,
  responsavel_id uuid references public.atendentes (id) on delete set null,
  erro_id uuid references public.ops_erros (id) on delete set null,
  alerta_id uuid references public.alertas (id) on delete set null,
  correlation_id text,
  causa text,
  solucao text,
  criado_por uuid references public.atendentes (id) on delete set null,
  resolvido_por uuid references public.atendentes (id) on delete set null,
  resolvido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ops_incidentes_status_idx on public.ops_incidentes (status, created_at desc);
create index if not exists ops_incidentes_clinica_idx on public.ops_incidentes (clinica_id, created_at desc);

create table if not exists public.ops_worker_heartbeats (
  nome text primary key,
  status text not null default 'saudavel' check (status in ('saudavel', 'atencao', 'falha')),
  ultimo_heartbeat_em timestamptz not null default now(),
  ultima_execucao_em timestamptz,
  ultima_falha_em timestamptz,
  fila_pendente int,
  detalhes jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.ops_deploys (
  id uuid primary key default gen_random_uuid(),
  ambiente text not null default 'producao',
  status text not null default 'desconhecido' check (status in ('sucesso', 'falha', 'em_andamento', 'desconhecido')),
  commit_sha text,
  deployment_id text,
  origem text,
  responsavel text,
  metadata jsonb not null default '{}'::jsonb,
  deployed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists ops_deploys_deployed_idx on public.ops_deploys (deployed_at desc);

alter table public.ops_erros enable row level security;
alter table public.ops_incidentes enable row level security;
alter table public.ops_worker_heartbeats enable row level security;
alter table public.ops_deploys enable row level security;

grant select, insert, update, delete on public.ops_erros to service_role;
grant select, insert, update, delete on public.ops_incidentes to service_role;
grant select, insert, update, delete on public.ops_worker_heartbeats to service_role;
grant select, insert, update, delete on public.ops_deploys to service_role;
