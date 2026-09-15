-- ============================================================================
-- CRM OdontoMinas — grants pra service_role (Fase 2)
-- Data: 2026-09-15
--
-- A migração anterior (2026-09-15_v1_schema.sql) criou as tabelas com RLS
-- ligado, mas este projeto Supabase não tem os default privileges padrão
-- (ALTER DEFAULT PRIVILEGES ... GRANT ALL TO service_role) configurados no
-- schema public — toda tabela nova nasce sem grant nenhum pra service_role.
-- BYPASSRLS (que a service_role já tem) e GRANT são camadas diferentes: a
-- primeira ignora as políticas de RLS, a segunda é o privilégio de tabela
-- que o Postgres exige de qualquer role, RLS à parte. Sem isso, toda
-- chamada do backend (Next.js, via service role key) toma "permission
-- denied for table" mesmo a tabela existindo.
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da 2026-09-15_v1_schema.sql.
-- ============================================================================

grant select, insert, update, delete on public.clinicas to service_role;
grant select, insert, update, delete on public.pacientes to service_role;
grant select, insert, update, delete on public.conversas to service_role;
grant select, insert, update, delete on public.mensagens to service_role;
grant select, insert, update, delete on public.eventos_funil to service_role;
grant select, insert, update, delete on public.consultas to service_role;
