-- ============================================================================
-- CRM OdontoMinas — V29: senha_hash opcional (fluxo de convite)
-- Data: 2026-09-18
--
-- Complementa a v28: conta em status 'invited' existe antes da pessoa
-- definir senha (fluxo: Dona convida -> e-mail -> pessoa define senha ->
-- status vira 'active'). `senha_hash` NOT NULL impedia esse estado
-- intermediário. Aditiva: nenhuma linha existente tem senha_hash nulo hoje,
-- então soltar a constraint não muda nada em produção.
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v28.
-- ============================================================================

alter table public.atendentes alter column senha_hash drop not null;

-- login (src/app/api/login/route.ts) já trata senha_hash ausente como
-- "credenciais inválidas" via HASH_DUMMY_TIMING (verificarSenha(_, null)
-- retorna false) — nenhuma mudança de código extra necessária pra manter
-- contas 'invited'/'pending_approval' fora do login antes da hora.

-- Verificação rápida (opcional):
--   select is_nullable from information_schema.columns where table_name='atendentes' and column_name='senha_hash';
