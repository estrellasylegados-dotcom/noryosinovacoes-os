-- ============================================================================
-- CRM OdontoMinas — V18: renomear "campanhas" (Disparos) → "disparos"
-- Data: 2026-09-16
--
-- Libera o nome "campanha" pro conceito estratégico novo (Ferramentas →
-- Campanhas: objetivo, público, canais, metas, receita — ver v19). O que
-- hoje se chama `campanhas`/`campanha_destinatarios` é, na nomenclatura do
-- módulo novo, um DISPARO: um lote de envio de WhatsApp (nome, mensagem,
-- público resolvido, worker que manda 1 a 1) — não tem objetivo, canal,
-- meta nem receita. Renomear em vez de duplicar evita ficar com duas coisas
-- chamadas "campanha" no mesmo banco pra sempre.
--
-- Puro rename de metadado — não reescreve nenhuma linha, não perde grant
-- nem RLS (são por OID de tabela, sobrevivem ao rename). Nomes de
-- constraint auto-gerados pela v17 (ex.: a unique key antiga) ficam com o
-- nome velho — cosmético, aceito conscientemente.
--
-- Rodar depois da v17, antes da v19. Nenhuma campanha (disparo) estava
-- "enviando" no momento desta migração (conferido antes de aplicar) — sem
-- risco de o worker in-process pegar a tabela no meio do rename.
-- ============================================================================

alter table public.campanhas rename to disparos;
alter table public.campanha_destinatarios rename to disparo_destinatarios;
alter table public.disparo_destinatarios rename column campanha_id to disparo_id;

alter index campanhas_clinica_status_idx rename to disparos_clinica_status_idx;
alter index campanha_destinatarios_fila_idx rename to disparo_destinatarios_fila_idx;

-- `integration_locks.provider = 'disparos'` (v17) já usava esse nome — nada a mudar lá.

-- Verificação rápida (opcional):
--   select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('disparos', 'disparo_destinatarios');
--   select status, count(*) from public.disparos group by status;
