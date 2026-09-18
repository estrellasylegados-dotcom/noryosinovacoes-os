-- ============================================================================
-- CRM OdontoMinas — V25: notas internas por conversa
-- Data: 2026-09-18
--
-- Anotação da equipe presa à conversa (Chat ao Vivo) — nunca vista pelo
-- paciente: nem o webhook da Evolution nem o motor do Fluxo de Conversa leem
-- esta tabela. Fase "Atendimento" do roteiro do Rafael (RBAC/Atendimento/
-- Kanban/Noryos Ops), item "notas internas".
--
-- Grant pra service_role incluído nesta mesma migração (mesmo cuidado de
-- v5/v6: este projeto Supabase não tem default privileges no schema public,
-- todo objeto novo nasce sem grant).
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v1..v24.
-- ============================================================================

create table if not exists public.notas_internas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  atendente_id uuid references public.atendentes (id) on delete set null,
  texto text not null,
  created_at timestamptz not null default now()
);

create index if not exists notas_internas_conversa_idx on public.notas_internas (conversa_id, created_at desc);
create index if not exists notas_internas_clinica_idx on public.notas_internas (clinica_id);

alter table public.notas_internas enable row level security;

grant select, insert, update, delete on public.notas_internas to service_role;

-- Verificação rápida (opcional):
--   select table_name from information_schema.tables
--   where table_schema = 'public' and table_name = 'notas_internas';
