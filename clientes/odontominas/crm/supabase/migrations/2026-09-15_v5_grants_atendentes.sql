-- ============================================================================
-- CRM OdontoMinas — grant pra service_role na tabela atendentes (V4)
-- Data: 2026-09-15
--
-- Mesmo bug da 2026-09-15_v1_grants.sql: este projeto Supabase não tem os
-- default privileges configurados no schema public, então a tabela nova
-- `atendentes` (criada em 2026-09-15_v4_equipe.sql) nasceu sem grant nenhum
-- pra service_role — toda chamada do backend toma "permission denied for
-- table atendentes" mesmo a tabela existindo e tendo dado.
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da 2026-09-15_v4_equipe.sql.
-- ============================================================================

grant select, insert, update, delete on public.atendentes to service_role;
