-- ============================================================================
-- CRM OdontoMinas — V27: SLA operacional por horário útil
-- Data: 2026-09-18
--
-- Fundação de SLA (primeira resposta humana + resposta durante atendimento),
-- calculado só em minutos úteis (src/lib/horario-atendimento.ts:
-- calcularMinutosUteisAtendimento) — nunca diferença bruta de timestamp.
-- Esta fatia NÃO conecta em automação nenhuma (WhatsApp/e-mail pra
-- supervisora, transferência automática, Kanban) — só a fundação.
--
-- Achado que motiva a 1ª alteração: `mensagens` não tinha como distinguir
-- resposta HUMANA de Fluxo/disparo/reativação (só `gerada_por_agente_id`
-- pra IA existia). Sem isso, "primeira resposta humana" é impossível de
-- calcular corretamente. Coluna nova, nullable, aditiva — só
-- enviarRespostaChat (src/lib/chat.ts) passa a preenchê-la; os outros 4
-- pontos de insert em `mensagens` continuam null (corretamente, não são
-- humano).
--
-- sla_eventos não reaproveita `automacao_eventos` (v23) de propósito: aquela
-- tabela é tipada pro domínio Fluxo (fluxo_id/execucao_id, `resultado` é
-- enum fechado de causas de não-disparo) — mexer no contrato dela pra caber
-- SLA arriscaria as fases que já dependem dela. Tabela nova, pequena, mesmo
-- padrão de idempotência (unique + insert, 23505 = sucesso).
--
-- Grant pra service_role incluído nesta mesma migração (mesmo cuidado de
-- v5/v6/v25/v26).
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v1..v26.
-- ============================================================================

alter table public.mensagens
  add column if not exists enviada_por_atendente_id uuid references public.atendentes (id) on delete set null;

create index if not exists mensagens_conversa_direcao_idx on public.mensagens (conversa_id, direcao, created_at);

create table if not exists public.sla_config (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null unique references public.clinicas (id) on delete cascade,
  ativo boolean not null default false,
  primeira_resposta_minutos int not null default 15 check (primeira_resposta_minutos > 0),
  resposta_atendimento_minutos int not null default 30 check (resposta_atendimento_minutos > 0),
  alerta_percentual int not null default 80 check (alerta_percentual > 0 and alerta_percentual <= 100),
  considerar_apenas_horario_util boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- clinica_id não duplica timezone (vem de `clinicas.timezone`, v26) nem
-- período (vem de `horario_atendimento_periodos`, v26) — SLA só guarda o
-- que é dele: limites e liga/desliga.

create table if not exists public.sla_eventos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  -- id da mensagem `recebida` que abriu o ciclo — dobra de identificador de
  -- ciclo (cycle_id): estável, já existe, sem inventar tabela de ciclos.
  mensagem_id uuid not null references public.mensagens (id) on delete cascade,
  tipo text not null check (tipo in ('primeira_resposta', 'resposta_atendimento')),
  limite_minutos int not null,
  minutos_consumidos int not null,
  atendente_responsavel_id uuid references public.atendentes (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (conversa_id, mensagem_id, tipo)
);

create index if not exists sla_eventos_clinica_idx on public.sla_eventos (clinica_id, created_at desc);

alter table public.sla_config enable row level security;
alter table public.sla_eventos enable row level security;

grant select, insert, update, delete on public.sla_config to service_role;
grant select, insert, update, delete on public.sla_eventos to service_role;

-- Verificação rápida (opcional):
--   select column_name from information_schema.columns where table_name='mensagens' and column_name='enviada_por_atendente_id';
--   select table_name from information_schema.tables where table_schema='public' and table_name in ('sla_config','sla_eventos');
