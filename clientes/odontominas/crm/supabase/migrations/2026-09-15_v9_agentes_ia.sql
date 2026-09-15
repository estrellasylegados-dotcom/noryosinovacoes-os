-- ============================================================================
-- CRM OdontoMinas — V9: Agentes de IA
-- Data: 2026-09-15
--
-- A pedido do Rafael (prints da RoiZap como referência de layout, adaptado ao
-- que o sistema realmente tem — ver andamento.md): um agente de IA por
-- clínica, ativado quando uma etiqueta-gatilho é aplicada numa conversa
-- (reaproveita `etiquetas`/`conversa_etiquetas` da v6, não cria catálogo de
-- tag novo). `conversas.agente_ativo_id` diz qual agente está "escutando"
-- aquela conversa; `agente_pausado_ate` é a trava temporária depois que um
-- humano responde manualmente (src/lib/chat.ts, enviarRespostaChat).
-- `mensagens.gerada_por_agente_id` marca qual mensagem saiu da IA, não de um
-- atendente.
--
-- Grant pra service_role incluído nesta mesma migração (mesmo bug de sempre
-- neste projeto Supabase: sem default privileges no schema public, todo
-- objeto novo nasce sem grant — v1_grants.sql, v5_grants_atendentes.sql).
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v1 até v8.
-- ============================================================================

create table if not exists public.agentes_ia (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nome text not null,
  descricao text,
  -- nasce Pausado (igual ao print de referência da RoiZap) — nada responde
  -- sozinho até o Rafael ativar explicitamente.
  ativo boolean not null default false,
  etiqueta_gatilho_id uuid references public.etiquetas (id) on delete set null,
  provider text not null check (provider in ('google', 'groq', 'openai', 'anthropic', 'deepseek')),
  modelo text not null,
  prompt_sistema text not null default '',
  temperatura numeric not null default 0.7 check (temperatura between 0 and 1),
  max_tokens integer not null default 700,
  max_mensagens_resposta integer not null default 3,
  incluir_historico boolean not null default true,
  qtd_historico integer not null default 10,
  pausar_ao_responder_humano boolean not null default true,
  tempo_pausa_min integer not null default 480,
  mensagem_transferencia text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversas
  add column if not exists agente_ativo_id uuid references public.agentes_ia (id) on delete set null;

alter table public.conversas
  add column if not exists agente_pausado_ate timestamptz;

alter table public.mensagens
  add column if not exists gerada_por_agente_id uuid references public.agentes_ia (id) on delete set null;

create index if not exists agentes_ia_clinica_idx on public.agentes_ia (clinica_id);
create index if not exists agentes_ia_etiqueta_gatilho_idx on public.agentes_ia (etiqueta_gatilho_id);
create index if not exists conversas_agente_ativo_idx on public.conversas (agente_ativo_id);
create index if not exists mensagens_gerada_por_agente_idx on public.mensagens (gerada_por_agente_id);

alter table public.agentes_ia enable row level security;

grant select, insert, update, delete on public.agentes_ia to service_role;

-- Verificação rápida (opcional):
--   select id, nome, ativo, provider, modelo from public.agentes_ia;
--   select agente_ativo_id, agente_pausado_ate from public.conversas limit 5;
