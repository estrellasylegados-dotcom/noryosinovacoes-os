-- ============================================================================
-- CRM OdontoMinas — V8: contador de mensagens não lidas por conversa
-- Data: 2026-09-15
--
-- A pedido do Rafael, comparando com a RoiZap: o Chat ao Vivo mostrava só um
-- "tem não lida" (bolinha), não quantas mensagens. `mensagens_nao_lidas`
-- guarda a contagem de verdade — incrementada a cada mensagem recebida
-- (webhook), zerada quando a conversa é aberta no painel ou respondida
-- (src/lib/chat.ts). O booleano `nao_lida` (v6) continua existindo, pros
-- filtros/índice — os dois andam juntos, nunca um sem o outro.
--
-- Sem grant novo: coluna em tabela que já tem GRANT pra service_role
-- (2026-09-15_v1_grants.sql).
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`.
-- ============================================================================

alter table public.conversas
  add column if not exists mensagens_nao_lidas integer not null default 0;

-- Backfill honesto: não dá pra saber quantas mensagens ficaram pra trás antes
-- desta coluna existir, então quem já estava marcado "não lida" (v6) ganha 1
-- (o mínimo verdadeiro), não um número inventado.
update public.conversas set mensagens_nao_lidas = 1 where nao_lida = true and mensagens_nao_lidas = 0;

-- Verificação rápida (opcional):
--   select nao_lida, mensagens_nao_lidas from public.conversas where nao_lida = true;
