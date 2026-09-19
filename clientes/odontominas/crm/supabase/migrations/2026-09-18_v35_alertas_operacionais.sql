-- ============================================================================
-- CRM OdontoMinas — V35: Central de Alertas Operacionais
-- Data: 2026-09-18
--
-- ALERTA NÃO É LOG: uma condição operacional que exige ação humana, com
-- ciclo de vida (aberto → assumido → resolvido | ignorado), dono, dedupe e
-- histórico. Só ADITIVA (3 tabelas novas + 1 de regras) — nenhuma tabela
-- existente é alterada, nada é apagado; rollback no fim do arquivo.
--
-- Reaproveita o que já existe em vez de criar motor paralelo:
--   * SLA: `sla_config` (ativo, alerta_percentual) e o cálculo de minutos
--     úteis de src/lib/sla.ts — nada de SLA duplicado aqui.
--   * Kanban: `oportunidades.estagio_entrou_em` (já reinicia a cada
--     movimento) é o relógio da "oportunidade parada".
--   * Canais: `canais.status/updated_at` + verificarSaudeCanal (ao vivo).
--   * Fluxo: `fluxo_execucoes.estado` ('failed', presas) — estados reais.
--   * Auditoria humana continua em `auditoria_eventos` (ALERTA_*).
--
-- DEDUPE NO BANCO (não em memória): `chave_ativa` = chave de deduplicação
-- enquanto a CONDIÇÃO existir; NULL = liberada (a condição acabou → a
-- próxima ocorrência vira alerta novo). Índice único sobre
-- (clinica, chave_ativa): NULL nunca conflita (igual ao Postgres inteiro),
-- então "1 condição = 1 alerta" vale mesmo com 2 processos criando juntos
-- (o 2º recebe 23505 e é tratado como deduplicado). Resolver/ignorar à mão
-- NÃO libera a chave: senão a condição ainda viva reabriria o alerta no
-- minuto seguinte (spam). Quem libera é o verificador, quando a condição
-- de fato termina.
--
-- `clinica_id` é NULLABLE de propósito: alerta de PLATAFORMA (futuro Noryos
-- Ops) não pertence a nenhuma clínica. Hoje todo alerta gerado tem clínica.
-- `natureza` separa operacional (atendimento) de técnico (plataforma).
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v1..v34.
-- ============================================================================

create table if not exists public.alertas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid references public.clinicas (id) on delete cascade,

  -- texto livre de propósito (sem CHECK): categoria/tipo novos não exigem migration.
  tipo text not null,
  categoria text not null,
  natureza text not null default 'operacional' check (natureza in ('operacional', 'tecnico')),
  severidade text not null check (severidade in ('informativo', 'atencao', 'critico')),
  status text not null default 'aberto' check (status in ('aberto', 'assumido', 'resolvido', 'ignorado')),

  titulo text not null,
  descricao text,

  tipo_entidade text,
  entidade_id uuid,
  responsavel_id uuid references public.atendentes (id) on delete set null,

  chave_deduplicacao text not null,
  chave_ativa text,
  dados jsonb not null default '{}'::jsonb,

  detectado_em timestamptz not null default now(),
  visualizado_em timestamptz,
  assumido_em timestamptz,
  assumido_por uuid references public.atendentes (id) on delete set null,
  resolvido_em timestamptz,
  resolvido_por uuid references public.atendentes (id) on delete set null,
  -- o que resolveu: 'manual' | 'resposta_humana' | 'conversa_assumida' | 'canal_recuperado' | ...
  resolvido_por_evento text,
  ignorado_em timestamptz,
  ignorado_por uuid references public.atendentes (id) on delete set null,
  ignorado_motivo text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dedupe / nova ocorrência (ver cabeçalho). coalesce: alerta de plataforma (clinica null) também deduplica.
create unique index if not exists alertas_chave_ativa_unq
  on public.alertas (coalesce(clinica_id, '00000000-0000-0000-0000-000000000000'::uuid), chave_ativa);

-- Central + contador do cabeçalho: só o que ainda exige atenção, críticos primeiro, mais antigos primeiro.
create index if not exists alertas_abertos_idx
  on public.alertas (clinica_id, severidade, detectado_em)
  where status in ('aberto', 'assumido');

-- Verificador: carrega de uma vez só os alertas com condição viva da clínica.
create index if not exists alertas_condicao_viva_idx
  on public.alertas (clinica_id, tipo)
  where chave_ativa is not null;

-- "Resolvidos hoje" e histórico recente.
create index if not exists alertas_resolvidos_idx
  on public.alertas (clinica_id, resolvido_em desc)
  where resolvido_em is not null;

-- Resolver/atualizar por entidade (conversa respondida, oportunidade movida…).
create index if not exists alertas_entidade_idx
  on public.alertas (clinica_id, tipo_entidade, entidade_id);

create index if not exists alertas_responsavel_idx
  on public.alertas (clinica_id, responsavel_id)
  where status in ('aberto', 'assumido');

create table if not exists public.alerta_historico (
  id uuid primary key default gen_random_uuid(),
  alerta_id uuid not null references public.alertas (id) on delete cascade,
  clinica_id uuid references public.clinicas (id) on delete cascade,
  evento text not null check (evento in ('criado', 'severidade_alterada', 'responsavel_alterado', 'assumido', 'resolvido', 'ignorado', 'reaberto')),
  de text,
  para text,
  ator_id uuid references public.atendentes (id) on delete set null,
  -- 'sistema' (verificador/evento) | 'usuario'
  origem text not null default 'sistema' check (origem in ('sistema', 'usuario')),
  -- o que causou: 'verificacao_periodica', 'resposta_humana', 'manual'…
  motivo text,
  created_at timestamptz not null default now()
);
create index if not exists alerta_historico_alerta_idx on public.alerta_historico (alerta_id, created_at);

-- Configuração mínima por clínica. `tipos_desabilitados` (lista negra) em vez de
-- lista branca: um tipo novo nasce ligado sem migration. SLA NÃO é configurado
-- aqui — vale `sla_config` (ativo + alerta_percentual).
create table if not exists public.alertas_config (
  clinica_id uuid primary key references public.clinicas (id) on delete cascade,
  tipos_desabilitados text[] not null default '{}',
  sem_responsavel_minutos integer not null default 10 check (sem_responsavel_minutos > 0),
  canal_carencia_minutos integer not null default 2 check (canal_carencia_minutos >= 0),
  ultima_verificacao_em timestamptz,
  ultima_verificacao_duracao_ms integer,
  updated_at timestamptz not null default now()
);

-- Tempo máximo por etapa do Kanban (1 regra por etapa). Minutos como unidade
-- única; a tela converte de/para minutos, horas ou dias.
create table if not exists public.alertas_kanban_regras (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  estagio_id uuid not null unique references public.pipeline_estagios (id) on delete cascade,
  limite_minutos integer not null check (limite_minutos > 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists alertas_kanban_regras_clinica_idx on public.alertas_kanban_regras (clinica_id) where ativo;

alter table public.alertas enable row level security;
alter table public.alerta_historico enable row level security;
alter table public.alertas_config enable row level security;
alter table public.alertas_kanban_regras enable row level security;

grant select, insert, update, delete on public.alertas to service_role;
grant select, insert, update, delete on public.alerta_historico to service_role;
grant select, insert, update, delete on public.alertas_config to service_role;
grant select, insert, update, delete on public.alertas_kanban_regras to service_role;

-- Verificação rápida (opcional):
--   select table_name from information_schema.tables where table_schema='public' and table_name like 'alerta%';
--
-- ROLLBACK (nada existente depende disto):
--   drop table if exists public.alertas_kanban_regras;
--   drop table if exists public.alertas_config;
--   drop table if exists public.alerta_historico;
--   drop table if exists public.alertas;
