-- ============================================================================
-- CRM OdontoMinas — v3: reativação de paciente inativo (Fase 5)
-- Data: 2026-09-15
--
-- `ultima_reativacao_em` marca quando a automação de reativação
-- (src/lib/reativacao.ts) mandou mensagem pra esta conversa — usado só pra
-- nunca mandar 2x a mesma reativação sozinha (V1: dispara 1x por conversa
-- inativa, sem repetição automática; cadência de repetição fica pra quando
-- o piloto validar o primeiro disparo).
--
-- Sem grant novo: coluna em tabela que já tem GRANT pra service_role
-- (2026-09-15_v1_grants.sql) — GRANT é por tabela, não por coluna.
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`.
-- ============================================================================

alter table public.conversas
  add column if not exists ultima_reativacao_em timestamptz;

-- Verificação rápida (opcional):
--   select id, status, ultima_mensagem_em, ultima_reativacao_em
--   from public.conversas order by created_at desc limit 20;
