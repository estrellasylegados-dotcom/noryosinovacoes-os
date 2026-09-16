-- ============================================================================
-- CRM OdontoMinas — V11: Agentes de IA, Fase 2B (buffer de mensagens)
-- Data: 2026-09-15
--
-- Hoje cada mensagem recebida no WhatsApp dispara uma resposta da IA na hora
-- (src/app/api/webhook/evolution/route.ts). Se o paciente manda várias
-- mensagens seguidas, a IA responde fragmentado, uma vez por mensagem. Esta
-- fase espera um tempo depois da última mensagem antes de responder, juntando
-- tudo que chegou nesse intervalo numa resposta só.
--
-- Arquitetura aprovada (ver _memoria/decisoes.md): debounce por coluna (não
-- timer em memória — sobrevive a restart do processo) + poll dentro do
-- próprio processo Next (não cron/serviço novo — ver src/lib/agentes-buffer.ts
-- e src/instrumentation.ts).
--
-- Opt-in por agente, desligado por padrão: o "Recepção Virtual" que já roda
-- validado em produção continua respondendo na hora até alguém ligar o
-- toggle nele.
--
-- Mesmas tabelas já existentes (agentes_ia desde v9, conversas desde v1) e já
-- com grant pro service_role — GRANT é por tabela, não por coluna, não
-- precisa repetir aqui.
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v10.
-- ============================================================================

alter table public.agentes_ia
  add column if not exists buffer_mensagens boolean not null default false;

alter table public.agentes_ia
  add column if not exists buffer_segundos integer not null default 8;

alter table public.conversas
  add column if not exists agente_buffer_desde timestamptz;

alter table public.conversas
  add column if not exists agente_buffer_ate timestamptz;

alter table public.conversas
  add column if not exists agente_buffer_novo_paciente boolean not null default false;

create index if not exists conversas_agente_buffer_ate_idx on public.conversas (agente_buffer_ate);

-- Verificação rápida (opcional):
--   select nome, buffer_mensagens, buffer_segundos from public.agentes_ia;
--   select id, agente_buffer_desde, agente_buffer_ate from public.conversas where agente_buffer_ate is not null;
