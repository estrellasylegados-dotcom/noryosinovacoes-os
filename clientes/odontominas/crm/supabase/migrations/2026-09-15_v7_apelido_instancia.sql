-- ============================================================================
-- CRM OdontoMinas — V7: apelido interno da instância de WhatsApp
-- Data: 2026-09-15
--
-- A pedido do Rafael (comparando com o "editar nome" da RoiZap): um nome
-- interno pro CRM mostrar (sidebar + página Conexão), independente do
-- profileName real do WhatsApp — nunca chama a Evolution API pra mudar o
-- perfil de verdade, é só rótulo local. Enquanto vazio, o app cai no nome
-- de perfil real como estava antes.
--
-- Sem grant novo: coluna em tabela que já tem GRANT pra service_role
-- (2026-09-15_v1_grants.sql) — GRANT é por tabela, não por coluna (mesmo
-- padrão de 2026-09-15_v3_reativacao.sql).
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`.
-- ============================================================================

alter table public.clinicas
  add column if not exists apelido_instancia text;

-- Verificação rápida (opcional):
--   select nome, slug, apelido_instancia from public.clinicas;
