-- ============================================================================
-- CRM OdontoMinas — V12: prompt estruturado dos Agentes de IA + Conhecimento
-- Data: 2026-09-16
--
-- A pedido do Rafael (print do "Agente 01" da RoiZap como referência de
-- layout, ver andamento.md): o Prompt do Agente ganha um modo "Simples"
-- estruturado (Persona, Objetivo, Fluxo e Triagem, Guardrails, Traços de
-- Personalidade) além do modo "Avançado" (o textarea único que já existia,
-- `prompt_sistema`). `modo_prompt` nasce 'avancado' por padrão pra não mudar
-- nada no agente "Recepção Virtual" que já está em produção — ele só passa a
-- usar o modo estruturado se alguém entrar e trocar.
--
-- Conhecimento é a única aba nova das 4 do print (Conhecimento, Qualificação,
-- Ferramentas, Pixel) que o Rafael decidiu construir de verdade agora — as
-- outras 3 não têm funcionalidade real por trás ainda (mesmo critério já
-- usado no Chat ao Vivo, sem copiar aba decorativa). `agentes_conhecimento`
-- guarda fatos curtos (título + conteúdo) que entram no prompt final pra
-- reduzir a IA inventando informação.
--
-- Grant pra service_role incluído nesta mesma migração (mesmo bug de sempre
-- neste projeto Supabase: sem default privileges no schema public — v1, v5,
-- v9).
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v11.
-- ============================================================================

alter table public.agentes_ia
  add column if not exists modo_prompt text not null default 'avancado'
    check (modo_prompt in ('simples', 'avancado')),
  add column if not exists persona text not null default '',
  add column if not exists objetivo text not null default '',
  add column if not exists fluxo_triagem text not null default '',
  add column if not exists guardrails text not null default '',
  add column if not exists tom_voz text not null default 'amigavel'
    check (tom_voz in ('amigavel', 'formal', 'entusiasmado', 'direto')),
  add column if not exists usar_emojis boolean not null default true;

create table if not exists public.agentes_conhecimento (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  agente_id uuid not null references public.agentes_ia (id) on delete cascade,
  titulo text not null,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index if not exists agentes_conhecimento_agente_idx on public.agentes_conhecimento (agente_id);

alter table public.agentes_conhecimento enable row level security;

grant select, insert, update, delete on public.agentes_conhecimento to service_role;

-- Verificação rápida (opcional):
--   select id, nome, modo_prompt, tom_voz, usar_emojis from public.agentes_ia;
--   select agente_id, titulo from public.agentes_conhecimento;
