-- ============================================================================
-- CRM OdontoMinas — schema V1 (Fase 2: espelhamento)
-- Data: 2026-09-15
--
-- Cria as 6 tabelas do V1 (clinicas, pacientes, conversas, mensagens,
-- eventos_funil, consultas), todas com `clinica_id` — arquitetura "path B":
-- modelo de dado pronto pra multi-clínica, mas esta instância atende só a
-- OdontoMinas por enquanto (ver andamento.md do projeto).
--
-- RLS ligado em toda tabela, sem policy: só a service role key (usada pelo
-- servidor Next.js) enxerga os dados — anon/authenticated ficam de fora por
-- padrão, igual ao resto do sistema. Não mexe em nada que já existe.
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`.
-- ============================================================================

create table if not exists public.clinicas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.pacientes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nome text,
  telefone text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinica_id, telefone)
);

create table if not exists public.conversas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  paciente_id uuid references public.pacientes (id) on delete set null,
  telefone text not null,
  canal text not null default 'whatsapp',
  instancia_evolution text,
  remote_jid text,
  status text not null default 'novo'
    check (status in ('novo', 'respondido', 'aguardando', 'agendado', 'perdido')),
  primeira_mensagem_em timestamptz,
  ultima_mensagem_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinica_id, telefone)
);

create table if not exists public.mensagens (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  direcao text not null check (direcao in ('recebida', 'enviada')),
  tipo text not null default 'texto',
  conteudo text,
  remote_jid text,
  evolution_message_id text unique,
  timestamp_whatsapp timestamptz,
  raw jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.eventos_funil (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  conversa_id uuid references public.conversas (id) on delete set null,
  status_anterior text,
  status_novo text not null,
  motivo text,
  created_at timestamptz not null default now()
);

create table if not exists public.consultas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  paciente_id uuid references public.pacientes (id) on delete set null,
  conversa_id uuid references public.conversas (id) on delete set null,
  data_hora timestamptz,
  status text not null default 'agendada'
    check (status in ('agendada', 'confirmada', 'realizada', 'cancelada', 'faltou')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pacientes_clinica_idx on public.pacientes (clinica_id);
create index if not exists conversas_clinica_status_idx on public.conversas (clinica_id, status);
create index if not exists mensagens_conversa_idx on public.mensagens (conversa_id);
create index if not exists mensagens_clinica_idx on public.mensagens (clinica_id);
create index if not exists eventos_funil_conversa_idx on public.eventos_funil (conversa_id);
create index if not exists consultas_clinica_idx on public.consultas (clinica_id);

alter table public.clinicas enable row level security;
alter table public.pacientes enable row level security;
alter table public.conversas enable row level security;
alter table public.mensagens enable row level security;
alter table public.eventos_funil enable row level security;
alter table public.consultas enable row level security;

-- Clínica piloto (id gerado; o app resolve por slug em src/lib/clinica.ts).
insert into public.clinicas (nome, slug)
values ('OdontoMinas', 'odontominas')
on conflict (slug) do nothing;

-- Verificação rápida (opcional):
--   select table_name from information_schema.tables
--   where table_schema = 'public'
--     and table_name in ('clinicas','pacientes','conversas','mensagens','eventos_funil','consultas')
--   order by table_name;
--   select id, nome, slug from public.clinicas where slug = 'odontominas';
