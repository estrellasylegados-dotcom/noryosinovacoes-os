-- ============================================================================
-- CRM OdontoMinas — V6: Chat ao Vivo (inbox estilo RoiZap)
-- Data: 2026-09-15
--
-- V1 tinha só "visibilidade + ação leve" (ver andamento.md, plano técnico do
-- CRM): lista de conversas + troca de status, sem thread nem resposta pelo
-- painel. Esta migração dá suporte à seção nova "Chat ao vivo" (a pedido do
-- Rafael, inspirada na ferramenta RoiZap que ele usa em outro nicho): não
-- lida, arquivada, prioridade e atribuição por conversa, mais etiquetas
-- (tags) livres — infraestrutura pronta mesmo sem um catálogo fixo de tags
-- pra este nicho ainda.
--
-- Grant pra service_role incluído nesta mesma migração (não numa v7 separada
-- de correção) — este projeto Supabase não tem default privileges no schema
-- public, todo objeto novo nasce sem grant (mesmo bug de v1_grants.sql e
-- v5_grants_atendentes.sql).
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v1/v2/v3/v4/v5.
-- ============================================================================

alter table public.conversas
  add column if not exists nao_lida boolean not null default false;

-- Conversa em aberto (novo) já é, por definição, algo que ninguém tratou
-- ainda — nasce não lida. O resto (já respondida/agendada/perdida alguma
-- vez) fica lido, pra não inundar a caixa de entrada no dia em que este
-- campo passa a existir.
update public.conversas set nao_lida = true where status = 'novo';

alter table public.conversas
  add column if not exists arquivada boolean not null default false;

alter table public.conversas
  add column if not exists prioridade text not null default 'normal'
    check (prioridade in ('baixa', 'normal', 'alta', 'urgente'));

alter table public.conversas
  add column if not exists atribuido_a uuid references public.atendentes (id) on delete set null;

create table if not exists public.etiquetas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nome text not null,
  cor text not null default '#0d9488',
  created_at timestamptz not null default now(),
  unique (clinica_id, nome)
);

create table if not exists public.conversa_etiquetas (
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  etiqueta_id uuid not null references public.etiquetas (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversa_id, etiqueta_id)
);

create index if not exists conversas_clinica_nao_lida_idx on public.conversas (clinica_id, nao_lida);
create index if not exists conversas_clinica_arquivada_idx on public.conversas (clinica_id, arquivada);
create index if not exists conversas_clinica_atribuido_idx on public.conversas (clinica_id, atribuido_a);
create index if not exists etiquetas_clinica_idx on public.etiquetas (clinica_id);
create index if not exists conversa_etiquetas_etiqueta_idx on public.conversa_etiquetas (etiqueta_id);

alter table public.etiquetas enable row level security;
alter table public.conversa_etiquetas enable row level security;

grant select, insert, update, delete on public.etiquetas to service_role;
grant select, insert, update, delete on public.conversa_etiquetas to service_role;

-- Verificação rápida (opcional):
--   select nao_lida, arquivada, prioridade, atribuido_a from public.conversas limit 5;
--   select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('etiquetas','conversa_etiquetas');
