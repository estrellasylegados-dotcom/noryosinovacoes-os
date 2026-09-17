-- ============================================================================
-- CRM OdontoMinas — V22: Pesquisas (NPS / satisfação / avaliação Google)
-- Data: 2026-09-17
--
-- Fase 3 do motor de Fluxo de Conversa (evolução arquitetural — ver
-- _memoria/decisoes.md). Infraestrutura GENÉRICA de pesquisa/solicitação —
-- não uma tabela por produto (NPS, satisfação e avaliação Google
-- compartilham a mesma infra; `tipo` diferencia a semântica). NPS é pesquisa
-- interna; avaliação Google é solicitação externa — nunca a mesma coisa
-- (ver decisão em _memoria/decisoes.md, "Google Reviews não é NPS").
--
-- Ciclo de vida: uma pesquisa existe ANTES de qualquer resposta (nasce
-- 'enviada' — este motor não tem hoje um passo de confirmação de entrega
-- separado do envio; toda mensagem do motor já é "melhor esforço", nunca
-- confirmada, ver fluxo-execucoes.ts:enviarComRetry). 'pendente' fica
-- reservado pra quando existir uma origem que precise desse estado
-- intermediário de verdade. Só nps/satisfacao chegam a 'respondida' —
-- avaliacao_google nunca ganha `pesquisa_respostas` fabricada (não há como
-- provar publicação de avaliação sem integração real).
--
-- `pesquisa_respostas` NÃO carrega `clinica_id` próprio: toda leitura passa
-- por `pesquisa_id` (FK obrigatória), que já isola por clínica via
-- `pesquisas.clinica_id` — duplicar a coluna aqui só criaria uma 2ª fonte de
-- verdade pra manter sincronizada sem ganho de segurança real (nenhuma
-- consulta a `pesquisa_respostas` faz sentido fora do contexto de uma
-- pesquisa já carregada). O índice em `pesquisa_id` cobre o caso de uso real
-- (respostas de uma pesquisa).
--
-- Rodar depois da v21.
-- ============================================================================

create table public.pesquisas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  paciente_id uuid not null references public.pacientes (id) on delete cascade,

  -- restrict, mesmo critério de fluxo_execucoes.fluxo_id/versao_id: registro
  -- de negócio real não pode sumir porque o fluxo que a criou foi excluído.
  fluxo_id uuid references public.fluxos (id) on delete restrict,
  execucao_id uuid references public.fluxo_execucoes (id) on delete set null,

  tipo text not null check (tipo in ('nps', 'satisfacao', 'avaliacao_google')),
  status text not null default 'enviada'
    check (status in ('pendente', 'enviada', 'respondida', 'expirada', 'cancelada')),

  -- Referência de negócio (ex.: id de atendimento/agendamento, ano do
  -- aniversário) — dado estruturado pra rastreabilidade; NÃO é a mesma coisa
  -- que a dedupe_key de fluxo_execucoes (essa é só concorrência/idempotência).
  referencia_id text,

  metadata jsonb not null default '{}'::jsonb,

  enviado_em timestamptz,
  respondido_em timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pesquisas_clinica_idx on public.pesquisas (clinica_id);
create index pesquisas_paciente_idx on public.pesquisas (paciente_id);
create index pesquisas_tipo_status_idx on public.pesquisas (clinica_id, tipo, status);

create table public.pesquisa_respostas (
  id uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references public.pesquisas (id) on delete cascade,

  valor_numero integer,
  valor_texto text,
  -- Só usado por tipo='nps' (detrator/neutro/promotor); calculado e gravado
  -- pela lógica de NPS (Fase 4) — Fase 3 só reserva a coluna, nunca escreve
  -- nela. Classificação é sempre derivada da nota original, nunca fonte
  -- primária (a nota em valor_numero é o dado real).
  classificacao text,
  comentario text,

  metadata jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index pesquisa_respostas_pesquisa_idx on public.pesquisa_respostas (pesquisa_id);

alter table public.pesquisas enable row level security;
alter table public.pesquisa_respostas enable row level security;

grant select, insert, update, delete on public.pesquisas to service_role;
grant select, insert, update, delete on public.pesquisa_respostas to service_role;
