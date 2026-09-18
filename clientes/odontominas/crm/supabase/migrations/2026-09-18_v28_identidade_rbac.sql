-- ============================================================================
-- CRM OdontoMinas — V28: identidade, login e RBAC granular
-- Data: 2026-09-18
--
-- Fundação da fase Identidade/Login/Equipe/RBAC (ver decisoes.md 2026-09-18).
-- Migração 100% aditiva: nenhuma coluna/tabela antiga é removida.
-- `papel` ('admin'|'atendente') fica como coluna legada, não lida mais pelo
-- código novo (fonte de verdade passa a ser `perfil`) — dropar só depois de
-- uma janela de validação em produção.
--
-- Decisões de desenho (ver docs/RBAC.md):
-- - Sem tabela `memberships` agora: hoje é 1 conta = 1 clínica (arquitetura
--   "path B", 1 clínica por deploy) e não existe nenhum usuário real
--   multi-clínica. Criar a tabela agora seria relação 1:1 sem uso real —
--   `clinica_id` direto em `atendentes` já cobre, e nada aqui impede
--   introduzir `memberships` de verdade quando existir uma 2ª clínica real
--   com usuário compartilhado.
-- - Sem tabela relacional de permissões: catálogo e defaults por perfil
--   vivem em código (src/lib/permissoes.ts), auditável e testável sem JOIN;
--   customização por pessoa (seção 13/39 do pedido) fica em
--   `permissoes_customizadas` (jsonb, lista resolvida completa; null = usa
--   default do perfil).
-- - `clinica_id` vira nullable: Noryos Admin/Noryos Suporte são identidade de
--   PLATAFORMA, não de uma clínica (seção 6/7) — não force um registro
--   fictício em `clinicas` só pra caber a constraint.
-- - Mapeamento das 3 contas reais hoje (nenhuma é a Ariadna ainda, são
--   placeholders de demo — ver agora.md): "admin"/"Administração" tem
--   clinica_id preenchido (não é conta de plataforma) → vira `dona`.
--   "recepcao1"/"recepcao2" → `atendente`. Confirmar com o Rafael antes de
--   criar a 1ª conta `noryos_admin` de verdade.
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v1..v27.
-- ============================================================================

alter table public.atendentes alter column clinica_id drop not null;

alter table public.atendentes add column if not exists email text;
alter table public.atendentes add column if not exists perfil text;
alter table public.atendentes add column if not exists status text;
alter table public.atendentes add column if not exists sessao_versao int not null default 0;
alter table public.atendentes add column if not exists permissoes_customizadas jsonb;
alter table public.atendentes add column if not exists origem text not null default 'noryos';
alter table public.atendentes add column if not exists criado_por uuid references public.atendentes (id) on delete set null;

-- Popula os dois campos novos a partir do dado real existente (não assume
-- "admin sempre vira dona" no vácuo — checado por SQL antes desta migração:
-- as 3 contas atuais são clínica única, então admin -> dona é o mapeamento
-- correto hoje; recepcao1/recepcao2 -> atendente).
update public.atendentes
  set perfil = case when papel = 'admin' then 'dona' else 'atendente' end
  where perfil is null;

update public.atendentes
  set status = case when ativo then 'active' else 'disabled' end
  where status is null;

alter table public.atendentes alter column perfil set not null;
alter table public.atendentes alter column status set not null;
alter table public.atendentes add constraint atendentes_perfil_check
  check (perfil in ('noryos_admin', 'noryos_suporte', 'dona', 'gerente', 'supervisora', 'atendente'));
alter table public.atendentes add constraint atendentes_status_check
  check (status in ('invited', 'pending_approval', 'active', 'blocked', 'disabled'));

-- `ativo` continua existindo e em sincronia (muito código ainda filtra por
-- ele) — a aplicação escreve os dois campos juntos a partir de agora
-- (ver src/lib/atendentes.ts). Nenhum trigger de banco: mantém a escrita
-- explícita e visível no código, mesmo padrão do resto do projeto.

create unique index if not exists atendentes_email_clinica_unq
  on public.atendentes (clinica_id, lower(email))
  where email is not null;

create table if not exists public.convites (
  id uuid primary key default gen_random_uuid(),
  atendente_id uuid not null references public.atendentes (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.atendentes (id) on delete set null
);
create index if not exists convites_atendente_idx on public.convites (atendente_id);

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  atendente_id uuid not null references public.atendentes (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_tokens_atendente_idx on public.password_reset_tokens (atendente_id);

-- Fundação pra futuro provider externo (ControleODONTO ou outro) — schema
-- só, sem nenhuma capability ligada (ver docs/CONTROLE-ODONTO-IDENTITY-INTEGRATION.md).
create table if not exists public.identidades_externas (
  id uuid primary key default gen_random_uuid(),
  atendente_id uuid not null references public.atendentes (id) on delete cascade,
  provider text not null,
  provider_subject text not null,
  provider_tenant_id text,
  external_email text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sync_at timestamptz,
  unique (provider, provider_subject)
);
create index if not exists identidades_externas_atendente_idx on public.identidades_externas (atendente_id);

create table if not exists public.auditoria_eventos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid references public.clinicas (id) on delete set null,
  ator_id uuid references public.atendentes (id) on delete set null,
  ator_perfil text,
  evento text not null,
  alvo_id uuid,
  detalhes jsonb,
  created_at timestamptz not null default now()
);
create index if not exists auditoria_eventos_clinica_idx on public.auditoria_eventos (clinica_id, created_at desc);

alter table public.convites enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.identidades_externas enable row level security;
alter table public.auditoria_eventos enable row level security;

grant select, insert, update, delete on public.convites to service_role;
grant select, insert, update, delete on public.password_reset_tokens to service_role;
grant select, insert, update, delete on public.identidades_externas to service_role;
grant select, insert, update, delete on public.auditoria_eventos to service_role;

-- Verificação rápida (opcional):
--   select usuario, papel, perfil, status, ativo, clinica_id from public.atendentes order by created_at;
--   select table_name from information_schema.tables where table_schema='public' and table_name in ('convites','password_reset_tokens','identidades_externas','auditoria_eventos');
