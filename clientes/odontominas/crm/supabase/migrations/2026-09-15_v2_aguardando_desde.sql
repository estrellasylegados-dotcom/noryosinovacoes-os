-- ============================================================================
-- CRM OdontoMinas — v2: aguardando_desde (reabertura de conversa)
-- Data: 2026-09-15
--
-- Fase 2/3 media "tempo até 1ª resposta" a partir de `primeira_mensagem_em`,
-- que é o 1º contato de sempre. Duas consequências não intencionais:
--
-- 1. Uma vez que a conversa vira "respondido"/"agendado"/"perdido", uma
--    mensagem nova do paciente não reabria a conversa nem reiniciava o
--    relógio — ela some do radar do painel (não volta a aparecer como
--    "novo"), e quando alguém finalmente olha, mostraria um "esperando há
--    Xh" contado desde o contato original, não desde a mensagem nova.
-- 2. Marcar uma conversa "perdido" direto a partir de "novo" (sem nunca ter
--    respondido) fazia o painel mostrar "respondeu em Xmin" — qualquer
--    saída de "novo" contava como resposta.
--
-- Corrigido no código (src/lib/funil.ts, src/lib/conversas.ts): mensagem
-- nova numa conversa resolvida reabre pra "novo" e reinicia o relógio;
-- "tempo até 1ª resposta" só conta transição de verdade pra "respondido".
--
-- `aguardando_desde` marca o início do ciclo de espera atual — criado junto
-- com a conversa (= primeira_mensagem_em nesse momento), e resetado toda
-- vez que uma mensagem reabre um ciclo encerrado. `primeira_mensagem_em`
-- continua intacto como o registro histórico do 1º contato de sempre.
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da 2026-09-15_v1_grants.sql. Sem novo grant: cobre a coluna nova junto do
-- grant de tabela já existente (GRANT é por tabela, não por coluna).
-- ============================================================================

alter table public.conversas
  add column if not exists aguardando_desde timestamptz;

update public.conversas
set aguardando_desde = coalesce(primeira_mensagem_em, created_at)
where aguardando_desde is null;

-- Verificação rápida (opcional):
--   select id, status, primeira_mensagem_em, aguardando_desde
--   from public.conversas order by created_at desc limit 20;
