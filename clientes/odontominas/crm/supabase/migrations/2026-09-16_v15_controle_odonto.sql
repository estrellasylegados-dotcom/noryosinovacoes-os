-- ============================================================================
-- CRM OdontoMinas — V15: Integração ControleODONTO (camada de sincronização)
-- Data: 2026-09-16
--
-- Primeira etapa da integração com o ControleODONTO (sistema de gestão da
-- própria clínica — camada clínica/prontuário/financeiro; ver decisão
-- 2026-09-14 em _memoria/decisoes.md: o CRM nunca mexe nessa camada). Cria só
-- a infraestrutura de sincronização (mapeamento de id externo, log, estado,
-- lock) — nenhuma tabela de negócio (pacientes/consultas) muda de formato.
--
-- Nenhuma capability de leitura/escrita está confirmada ainda (ver
-- docs/integrations/controle-odonto.md): estas tabelas nascem vazias e
-- continuam vazias até existir credencial real e endpoint/autenticação
-- validados — ver src/lib/controle-odonto/capabilities.ts.
--
-- `provider` fica como texto livre (sem check), de propósito: a mesma
-- estrutura deve servir outros ERPs odontológicos no futuro (Clinicorp
-- etc.), não só o ControleODONTO desta clínica.
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v14.
-- ============================================================================

-- Mapeamento genérico entre entidade local (paciente, consulta, ...) e id de
-- sistema externo — evita colunas `controleodonto_x_id` espalhadas pelas
-- tabelas de negócio, e já nasce pronta pra mais de 1 provedor por entidade.
create table if not exists public.external_ids (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  provider text not null default 'controle_odonto',
  entity_type text not null check (entity_type in ('paciente', 'consulta', 'profissional', 'estabelecimento')),
  entity_id uuid,
  external_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinica_id, provider, entity_type, external_id)
);

create index if not exists external_ids_entity_idx on public.external_ids (clinica_id, provider, entity_type, entity_id);

-- Auditoria de cada tentativa de sincronização (sucesso ou erro) — nunca
-- grava senha/token/payload clínico completo, só o necessário pra
-- diagnosticar (ver src/lib/controle-odonto/sync-log.ts).
create table if not exists public.integration_sync_log (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  provider text not null default 'controle_odonto',
  resource text not null,
  operation text not null check (operation in ('leitura', 'criacao', 'atualizacao', 'cancelamento')),
  direction text not null check (direction in ('entrada', 'saida')),
  external_id text,
  local_id uuid,
  status text not null check (status in ('sucesso', 'erro', 'ignorado')),
  attempt int not null default 1,
  http_status int,
  duration_ms int,
  error_code text,
  error_message_sanitized text,
  started_at timestamptz not null,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists integration_sync_log_clinica_idx on public.integration_sync_log (clinica_id, provider, created_at desc);
create index if not exists integration_sync_log_status_idx on public.integration_sync_log (clinica_id, provider, status, created_at desc);

-- Checkpoint por (clínica, provedor, recurso) — evita depender só de "rodou
-- pela última vez às", e alimenta o painel (saúde, contagens, latência).
create table if not exists public.integration_sync_state (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  provider text not null default 'controle_odonto',
  resource text not null,
  health text not null default 'nao_configurada' check (health in ('saudavel', 'degradada', 'indisponivel', 'nao_configurada')),
  last_success_at timestamptz,
  last_cursor text,
  last_window_start timestamptz,
  last_window_end timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  consecutive_failures int not null default 0,
  last_duration_ms int,
  last_run_count int,
  connector_version text,
  updated_at timestamptz not null default now(),
  unique (clinica_id, provider, resource)
);

-- Lock distribuído simples (chave primária composta = exclusão mútua real no
-- Postgres): evita o cron e o botão "Sincronizar agora" rodarem juntos.
create table if not exists public.integration_locks (
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  provider text not null default 'controle_odonto',
  resource text not null,
  holder text not null,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (clinica_id, provider, resource)
);

alter table public.external_ids enable row level security;
alter table public.integration_sync_log enable row level security;
alter table public.integration_sync_state enable row level security;
alter table public.integration_locks enable row level security;

grant select, insert, update, delete on public.external_ids to service_role;
grant select, insert, update, delete on public.integration_sync_log to service_role;
grant select, insert, update, delete on public.integration_sync_state to service_role;
grant select, insert, update, delete on public.integration_locks to service_role;

-- Verificação rápida (opcional):
--   select table_name from information_schema.tables
--   where table_schema = 'public'
--     and table_name in ('external_ids','integration_sync_log','integration_sync_state','integration_locks')
--   order by table_name;
--   select provider, resource, health from public.integration_sync_state;
