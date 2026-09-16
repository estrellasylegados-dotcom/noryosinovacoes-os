-- ============================================================================
-- CRM OdontoMinas — V16: fundamentos de Disparos (opt-out, mensagens salvas,
-- motor de públicos)
-- Data: 2026-09-16
--
-- Fase A da evolução de "Ferramentas → Disparos" (ver auditoria: o módulo de
-- Disparos não existia antes desta migração, nem opt-out em lugar nenhum do
-- código). Esta migração só cria a base reutilizável por qualquer módulo que
-- venha a mandar mensagem em massa (Disparos, e no futuro Automações/Funil):
-- nenhuma tabela de negócio existente muda de comportamento.
--
-- `opt_out_em`/`opt_out_origem` ficam no próprio paciente (não uma tabela à
-- parte): é o dado mais consultado por qualquer emissor de mensagem, e
-- "minimizar dados" (LGPD, já é princípio do contexto.md do projeto) pesa
-- contra criar uma entidade separada pra um booleano com data.
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v15.
-- ============================================================================

alter table public.pacientes
  add column if not exists opt_out_em timestamptz,
  add column if not exists opt_out_origem text;

create index if not exists pacientes_opt_out_idx on public.pacientes (clinica_id, opt_out_em);

-- Biblioteca de mensagens salvas (templates) — variáveis ({nome},
-- {primeiro_nome}, {telefone}) são resolvidas na hora do envio
-- (src/lib/mensagens-salvas.ts), nunca gravadas já substituídas aqui.
create table if not exists public.mensagens_salvas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nome text not null,
  conteudo text not null,
  criado_por uuid references public.atendentes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mensagens_salvas_clinica_idx on public.mensagens_salvas (clinica_id);

-- Motor de públicos: segmento salvo e reutilizável. `filtro` é estruturado
-- (jsonb com forma conhecida — ver FiltroAudiencia em src/lib/audiencias.ts),
-- nunca SQL livre, pra ficar auditável e igual em qualquer módulo que vier a
-- consumir (Disparos primeiro; Automações/Funil depois, mesma regra).
create table if not exists public.audiencias (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nome text not null,
  descricao text,
  filtro jsonb not null default '{}'::jsonb,
  ultima_contagem int,
  ultima_resolucao_em timestamptz,
  criado_por uuid references public.atendentes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists audiencias_clinica_idx on public.audiencias (clinica_id);

alter table public.mensagens_salvas enable row level security;
alter table public.audiencias enable row level security;

grant select, insert, update, delete on public.mensagens_salvas to service_role;
grant select, insert, update, delete on public.audiencias to service_role;

-- Verificação rápida (opcional):
--   select opt_out_em, opt_out_origem from public.pacientes limit 5;
--   select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('mensagens_salvas','audiencias');
