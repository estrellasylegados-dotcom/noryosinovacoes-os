-- ============================================================================
-- CRM OdontoMinas — V23: automacao_eventos (observabilidade)
-- Data: 2026-09-17
--
-- Fase 3 do motor de Fluxo de Conversa (evolução arquitetural — ver
-- _memoria/decisoes.md). Responde "por que essa automação não disparou?"
-- sem depender de log de aplicação (stdout). Escrita controlada de propósito
-- (ver src/lib/fluxo-eventos-internos.ts e src/lib/fluxo-scanner-temporal.ts):
-- eventos internos gravam 1 linha por emissão (são raros por natureza); o
-- scanner temporal grava 1 linha por execução iniciada/erro individual, mais
-- 1 linha agregada por rodada — nunca 1 linha por paciente irrelevante
-- avaliado em lote.
--
-- Rodar depois da v22.
-- ============================================================================

create table public.automacao_eventos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  paciente_id uuid references public.pacientes (id) on delete set null,
  fluxo_id uuid references public.fluxos (id) on delete set null,
  execucao_id uuid references public.fluxo_execucoes (id) on delete set null,

  evento_tipo text not null,
  referencia_id text,

  resultado text not null check (resultado in (
    'execucao_iniciada',
    'fluxo_nao_encontrado',
    'fluxo_inativo',
    'paciente_nao_elegivel',
    'dado_obrigatorio_ausente',
    'idempotencia_existente',
    'erro',
    'resumo_agregado'
  )),

  detalhe jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index automacao_eventos_clinica_idx on public.automacao_eventos (clinica_id, created_at desc);
create index automacao_eventos_tipo_resultado_idx on public.automacao_eventos (clinica_id, evento_tipo, resultado);

alter table public.automacao_eventos enable row level security;
grant select, insert, update, delete on public.automacao_eventos to service_role;
