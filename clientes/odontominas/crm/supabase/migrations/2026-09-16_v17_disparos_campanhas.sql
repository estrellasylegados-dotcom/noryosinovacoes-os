-- ============================================================================
-- CRM OdontoMinas — V17: Disparos — Fase B (campanhas)
-- Data: 2026-09-16
--
-- Fecha o módulo "Ferramentas → Disparos" iniciado na Fase A (v16: opt-out,
-- mensagens salvas, motor de públicos/audiências). Cria a tabela de campanha
-- e o snapshot de destinatários que o wizard e o worker de envio in-process
-- (src/lib/disparos-worker.ts) consomem.
--
-- `mensagem_texto` e `filtro` são sempre um SNAPSHOT no momento da criação da
-- campanha — mesmo quando vieram de uma mensagem salva ou audiência salva,
-- editar o original depois não muda campanha já criada.
--
-- `campanha_destinatarios.telefone`/`nome` também são snapshot (do motor de
-- públicos no momento da criação): o worker reconfere opt-out/telefone ao
-- vivo antes de cada envio (não confia só nisso), mas não junta com
-- `pacientes` de novo pra montar a lista.
--
-- Reaproveita `public.integration_locks` (v15) com provider = 'disparos' pro
-- lock do worker — não precisa de tabela nova pra isso.
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v16.
-- ============================================================================

create table if not exists public.campanhas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nome text not null,
  mensagem_salva_id uuid references public.mensagens_salvas (id) on delete set null,
  mensagem_texto text not null,
  audiencia_id uuid references public.audiencias (id) on delete set null,
  filtro jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'enviando', 'pausada', 'concluida', 'cancelada')),
  total_destinatarios int not null default 0,
  total_enviados int not null default 0,
  total_falhas int not null default 0,
  total_pulados int not null default 0,
  criado_por uuid references public.atendentes (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  iniciado_em timestamptz,
  concluido_em timestamptz
);
create index if not exists campanhas_clinica_status_idx on public.campanhas (clinica_id, status);

create table if not exists public.campanha_destinatarios (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas (id) on delete cascade,
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  paciente_id uuid not null references public.pacientes (id) on delete cascade,
  conversa_id uuid references public.conversas (id) on delete set null,
  telefone text not null,
  nome text,
  ordem int not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'falha', 'pulado_opt_out', 'telefone_invalido', 'cancelado')),
  enviado_em timestamptz,
  erro text,
  evolution_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campanha_id, paciente_id)
);
-- É a query que o worker roda a cada ciclo: próximo pendente de 1 campanha, em ordem.
create index if not exists campanha_destinatarios_fila_idx on public.campanha_destinatarios (campanha_id, status, ordem);

alter table public.campanhas enable row level security;
alter table public.campanha_destinatarios enable row level security;

grant select, insert, update, delete on public.campanhas to service_role;
grant select, insert, update, delete on public.campanha_destinatarios to service_role;

-- Verificação rápida (opcional):
--   select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('campanhas', 'campanha_destinatarios')
--   order by table_name;
--   select status, count(*) from public.campanhas group by status;
