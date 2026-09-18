-- ============================================================================
-- CRM OdontoMinas — V31: unicidade de conversa por canal (fecha a fase de canais)
-- Data: 2026-09-19
--
-- SÓ aplicar depois da v30, do deploy do código novo e da verificação:
--   select count(*) from public.conversas where canal_id is null;   -- deve ser 0
--
-- Troca UNIQUE (clinica_id, telefone) por UNIQUE (clinica_id, canal_id,
-- telefone) (já criado na v30): o mesmo paciente passa a poder ter uma
-- conversa por canal. Paciente continua único por (clinica_id, telefone).
--
-- Rollback: só é limpo enquanto não existir 2ª conversa do mesmo telefone.
-- Antes de reverter, conferir:
--   select clinica_id, telefone, count(*) from public.conversas
--   group by 1, 2 having count(*) > 1;
-- Se vazio: alter table public.conversas add constraint
--   conversas_clinica_id_telefone_key unique (clinica_id, telefone);
-- ============================================================================

alter table public.conversas drop constraint if exists conversas_clinica_id_telefone_key;
alter table public.conversas alter column canal_id set not null;
