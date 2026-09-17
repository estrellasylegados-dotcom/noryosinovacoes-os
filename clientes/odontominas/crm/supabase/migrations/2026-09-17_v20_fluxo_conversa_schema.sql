-- ============================================================================
-- CRM OdontoMinas — V20: Fluxo de Conversa (schema, Fase 1)
-- Data: 2026-09-17
--
-- NÃO APLICADA em produção ainda — esta é a proposta de schema da Fase 1 da
-- reconstrução do módulo "Ferramentas → Fluxo de Conversa" (decisão completa
-- em _memoria/decisoes.md, 2026-09-16 e 2026-09-17; desenho detalhado em
-- crm/docs/fluxo-conversa-arquitetura.md). Aplicar só depois de aprovação
-- explícita do Rafael, via mcp__supabase-crm-odontominas__apply_migration —
-- nunca automaticamente.
--
-- 4 tabelas novas (fluxos, fluxo_versoes, fluxo_execucoes,
-- fluxo_execucao_eventos) + 1 alteração em conversas (arbitragem
-- Fluxo/Agente de IA/Humano). Nenhum código de aplicação (worker, rotas, UI)
-- existe ainda — isso é Fase 2/3, checkpoints separados.
--
-- Rodar depois da v19.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- fluxos: o fluxo como container. Ciclo de vida (ativo/pausado/arquivado) é
-- um nível diferente de "publicada/rascunho" (que é da versão) — pausar um
-- fluxo desliga novos gatilhos independente de qual versão está publicada.
-- gatilho_tipo/gatilho_config ficam denormalizados da versão publicada
-- (copiados no momento de "Publicar") porque o webhook precisa responder
-- "qual fluxo ativo tem este gatilho" em toda mensagem recebida — hot path,
-- não pode depender de abrir o jsonb de fluxo_versoes.definicao a cada vez.
-- ----------------------------------------------------------------------------
create table public.fluxos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,

  nome text not null,
  descricao text,
  pasta text,

  status text not null default 'ativo'
    check (status in ('ativo', 'pausado', 'arquivado')),

  gatilho_tipo text,
  gatilho_config jsonb not null default '{}'::jsonb,

  -- false (padrão seguro): um gatilho deste fluxo nunca assume a conversa
  -- enquanto ela estiver com o Agente de IA ativo — precisa opt-in explícito.
  pode_interromper_agente_ia boolean not null default false,

  criado_por uuid references public.atendentes (id) on delete set null,
  pausado_por uuid references public.atendentes (id) on delete set null,
  arquivado_por uuid references public.atendentes (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  pausado_em timestamptz,
  arquivado_em timestamptz
);

create index fluxos_clinica_status_idx on public.fluxos (clinica_id, status);
create index fluxos_gatilho_idx on public.fluxos (clinica_id, gatilho_tipo) where status = 'ativo';

-- ----------------------------------------------------------------------------
-- fluxo_versoes: snapshot imutável por versão. `definicao` guarda nós +
-- arestas + config do editor visual inteiro como jsonb — não normalizado em
-- tabelas fluxo_nos/fluxo_arestas (mesmo espírito de campanhas.metas jsonb:
-- menos tabela, versão vira 1 linha em vez de N, editar rascunho não implica
-- reescrever grafo relacional). A estrutura do JSON é validada por schema de
-- aplicação (zod) em toda escrita — nunca aceita JSON livre; validação de
-- grafo (nó órfão, loop sem condição, caminho sem saída) é código de
-- aplicação na biblioteca da engine (Fase 2), não constraint de banco.
--
-- O índice único parcial abaixo É a garantia estrutural de versionamento:
-- só 1 versão "publicada" por fluxo — editar o fluxo ativo cria uma versão
-- nova em rascunho, nunca sobrescreve a publicada; execuções em andamento
-- apontam pro versao_id exato (snapshot), nunca pro "fluxo atual".
-- ----------------------------------------------------------------------------
create table public.fluxo_versoes (
  id uuid primary key default gen_random_uuid(),
  -- restrict, não cascade: excluir um fluxo nunca deve apagar em cascata o
  -- histórico de versões (nenhum fluxo é excluído de verdade pelo app — só
  -- arquivado — mas o schema não deve depender disso pra proteger histórico).
  fluxo_id uuid not null references public.fluxos (id) on delete restrict,
  clinica_id uuid not null references public.clinicas (id) on delete cascade,

  numero integer not null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'publicada', 'substituida', 'arquivada')),

  -- {nodes: [...], edges: [...], config: {...}} — schema validado em código.
  definicao jsonb not null default '{}'::jsonb,

  publicado_por uuid references public.atendentes (id) on delete set null,
  publicado_em timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (fluxo_id, numero)
);

create unique index fluxo_versoes_publicada_unica_idx on public.fluxo_versoes (fluxo_id)
  where status = 'publicada';
create index fluxo_versoes_fluxo_idx on public.fluxo_versoes (fluxo_id);

-- ----------------------------------------------------------------------------
-- fluxo_execucoes: 1 linha por execução. `aguardando_ate` é o mesmo padrão
-- já validado em conversas.agente_buffer_ate (Fase 2B dos Agentes de IA) —
-- serve tanto pra nó de espera quanto pra timeout de input (mesmo campo: se
-- estado='waiting_input', o valor é o deadline do timeout, não uma 2ª
-- espera). `passos_executados` é contador monotônico: fonte da `sequencia`
-- de idempotência em fluxo_execucao_eventos e disjuntor de segurança contra
-- loop não pego pelo validador de publicação (teto fixo checado em código
-- antes de cada passo). gatilho_tipo/gatilho_ref_id/gatilho_dedupe_key são
-- genéricos em vez de 1 FK por tipo de origem possível (campanha, disparo,
-- consulta, etiqueta...) — evita a tabela crescer a cada gatilho novo da
-- paleta; campanha_id fica explícito porque já é a única integração nomeada
-- na visão original ("registrar campaign_id").
-- ----------------------------------------------------------------------------
create table public.fluxo_execucoes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  -- restrict em ambos, mesmo motivo de fluxo_versoes.fluxo_id acima: uma
  -- execução é o registro de auditoria de uma automação com paciente real —
  -- nunca some porque o fluxo ou a versão que a gerou foram excluídos.
  fluxo_id uuid not null references public.fluxos (id) on delete restrict,
  versao_id uuid not null references public.fluxo_versoes (id) on delete restrict,

  conversa_id uuid not null references public.conversas (id) on delete cascade,
  paciente_id uuid references public.pacientes (id) on delete set null,

  estado text not null default 'queued'
    check (estado in (
      'queued', 'running', 'waiting_input', 'waiting_time',
      'completed', 'cancelled', 'failed', 'transferred'
    )),
  no_atual_id text,

  aguardando_ate timestamptz,
  passos_executados integer not null default 0,

  variaveis jsonb not null default '{}'::jsonb,

  gatilho_tipo text not null,
  gatilho_ref_id uuid,
  gatilho_dedupe_key text,

  campanha_id uuid references public.campanhas (id) on delete set null,

  is_test boolean not null default false,

  motivo_finalizacao text,
  erro text,
  transferido_para_atendente_id uuid references public.atendentes (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalizado_em timestamptz
);

create index fluxo_execucoes_aguardando_idx on public.fluxo_execucoes (aguardando_ate)
  where estado in ('waiting_time', 'waiting_input');

-- Uma execução ativa por conversa, entre TODOS os fluxos — evita 2 fluxos
-- concorrentes na mesma conversa sem regra explícita (pedido da visão
-- original: "uma conversa não pode ter duas instâncias do mesmo fluxo
-- concorrentes sem regra explícita" — estendido aqui pra "de qualquer
-- fluxo", que é a leitura mais segura).
create unique index fluxo_execucoes_conversa_ativa_idx on public.fluxo_execucoes (conversa_id)
  where estado in ('queued', 'running', 'waiting_input', 'waiting_time');

-- Índice plano (não parcial) em conversa_id: histórico de execuções de uma
-- conversa (ficha do paciente, log passado) inclui estados finais
-- (completed/failed/...) que o índice parcial acima não cobre.
create index fluxo_execucoes_conversa_idx on public.fluxo_execucoes (conversa_id);

-- Deduplicação de gatilho: mesmo evento de origem (ex. mesma
-- campanha+paciente) nunca inicia 2 execuções do mesmo fluxo.
create unique index fluxo_execucoes_gatilho_dedupe_idx on public.fluxo_execucoes (fluxo_id, gatilho_dedupe_key)
  where gatilho_dedupe_key is not null;

-- Métricas por fluxo (funil iniciaram/avançaram/concluíram, janela de
-- período) e, junto com o índice de versao_id abaixo, performance da
-- verificação de FK (restrict) quando alguém tentar excluir um fluxo/versão.
create index fluxo_execucoes_fluxo_criado_idx on public.fluxo_execucoes (fluxo_id, created_at);
create index fluxo_execucoes_versao_idx on public.fluxo_execucoes (versao_id);

create index fluxo_execucoes_clinica_idx on public.fluxo_execucoes (clinica_id);

-- ----------------------------------------------------------------------------
-- fluxo_execucao_eventos: log passo a passo (pro "log visual da execução" da
-- visão) e a idempotência real do motor. Chave é unique(execucao_id,
-- sequencia) — NÃO (execucao_id, no_id, tentativa): um loop controlado
-- revisita o mesmo no_id mais de uma vez legitimamente, e `sequencia` (o
-- passos_executados pós-incremento, reivindicado atomicamente por um UPDATE
-- condicional em fluxo_execucoes) identifica a VISITA, não o nó. `tentativa`
-- conta retry dentro do mesmo passo lógico (ex. nó de webhook/API tentando
-- de novo), nunca cria linha nova — mesmo espírito de "insert puro + tratar
-- 23505 como sucesso/ocupado" já validado em campanha_eventos/mensagens.
--
-- `status`: o evento nasce 'em_andamento' (gravado ANTES do efeito colateral
-- externo — mandar mensagem, chamar API — nunca depois), só vira 'concluido'
-- quando o passo termina de verdade. É o que permite recovery pós-restart:
-- se o processo cair no meio de um passo, o evento fica preso em
-- 'em_andamento' e uma varredura no boot do worker acha e trata esses casos
-- (índice dedicado abaixo) em vez de repetir ou perder o passo silenciosamente.
-- `updated_at` marca a última escrita (transição de status ou incremento de
-- `tentativa` num retry) — sem ele não dá pra saber quando um retry aconteceu.
-- ----------------------------------------------------------------------------
create table public.fluxo_execucao_eventos (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references public.fluxo_execucoes (id) on delete cascade,
  clinica_id uuid not null references public.clinicas (id) on delete cascade,

  sequencia integer not null,
  no_id text not null,
  tipo_evento text not null,
  tentativa integer not null default 1,

  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'concluido', 'falhou')),

  payload jsonb not null default '{}'::jsonb,
  duracao_ms integer,
  erro text,
  is_test boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (execucao_id, sequencia)
);

create index fluxo_execucao_eventos_execucao_no_idx on public.fluxo_execucao_eventos (execucao_id, no_id);

-- Recovery pós-restart: varredura no boot busca só o que ficou preso
-- ('em_andamento' há mais tempo que uma janela de graça curta, ex. 2 min) —
-- índice parcial mantém isso barato mesmo com a tabela crescendo (a imensa
-- maioria dos eventos vira 'concluido' em milissegundos e sai do índice).
create index fluxo_execucao_eventos_em_andamento_idx on public.fluxo_execucao_eventos (created_at)
  where status = 'em_andamento';

-- ----------------------------------------------------------------------------
-- conversas: arbitragem Fluxo / Agente de IA / Humano. Hoje "humano é dono" é
-- IMPLÍCITO (agente_ativo_id is null) — quebra assim que existe um 3º
-- candidato. `dono_conversa` é o roteador explícito, checado ANTES de
-- agente_ativo_id/agente_pausado_ate (que não mudam em nada). Backfill
-- reproduz a regra implícita atual — nenhuma conversa existente muda de
-- comportamento até o motor novo começar a escrever 'fluxo' de verdade.
-- ----------------------------------------------------------------------------
alter table public.conversas
  add column if not exists dono_conversa text not null default 'humano'
    check (dono_conversa in ('humano', 'agente_ia', 'fluxo')),
  add column if not exists fluxo_execucao_ativa_id uuid
    references public.fluxo_execucoes (id) on delete set null;

update public.conversas set dono_conversa = 'agente_ia' where agente_ativo_id is not null;

create index conversas_dono_idx on public.conversas (dono_conversa);

-- ----------------------------------------------------------------------------
-- RLS + grants — mesmo padrão de toda migration deste projeto (só a service
-- role key do servidor Next.js enxerga os dados; anon/authenticated de fora).
-- ----------------------------------------------------------------------------
alter table public.fluxos enable row level security;
alter table public.fluxo_versoes enable row level security;
alter table public.fluxo_execucoes enable row level security;
alter table public.fluxo_execucao_eventos enable row level security;

grant select, insert, update, delete on public.fluxos to service_role;
grant select, insert, update, delete on public.fluxo_versoes to service_role;
grant select, insert, update, delete on public.fluxo_execucoes to service_role;
grant select, insert, update, delete on public.fluxo_execucao_eventos to service_role;

-- Verificação rápida (opcional, depois de aplicar):
--   select table_name from information_schema.tables
--   where table_schema = 'public'
--     and table_name in ('fluxos','fluxo_versoes','fluxo_execucoes','fluxo_execucao_eventos')
--   order by table_name;
--   select dono_conversa, count(*) from public.conversas group by dono_conversa;
