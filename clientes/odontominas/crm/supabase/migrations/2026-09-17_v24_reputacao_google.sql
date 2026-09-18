-- ============================================================================
-- CRM OdontoMinas — V24: Reputação / Google Reviews (Fase 5)
-- Data: 2026-09-17
--
-- Fase 5 do motor de Fluxo de Conversa — reaproveita `pesquisas` (tipo
-- 'avaliacao_google', já preparado desde a v22) em vez de infraestrutura
-- paralela. Duas peças novas:
--
-- 1) `reputacao_config`: 1 linha por clínica (mesmo desenho de `clinicas`,
--    não existe tabela de settings genérica no projeto) — URL oficial do
--    Google, tracking de clique liga/desliga, delay pra automação futura
--    (guardado, não usado ainda — não existe hoje uma origem confiável de
--    `atendimento_concluido`, ver src/lib/fluxo-eventos-internos.ts).
--
-- 2) 3 colunas em `pesquisas`, só usadas por tipo='avaliacao_google': o
--    token opaco do link rastreável, sua validade, e quando foi clicado.
--    Não é tabela separada de propósito — nenhum outro tipo de pesquisa
--    precisa disso, e cada token pertence a exatamente 1 pesquisa.
--
-- `status` ganha 'clicada'/'falhou': o CHECK antigo (pendente/enviada/
-- respondida/expirada/cancelada) não tinha esses dois estados — Google
-- Reviews nunca chega a 'respondida' (não é NPS, ver decisão em
-- _memoria/decisoes.md), mas precisa registrar clique real e falha de envio.
--
-- Rodar depois da v23.
-- ============================================================================

create table public.reputacao_config (
  clinica_id uuid primary key references public.clinicas (id) on delete cascade,
  ativo boolean not null default false,
  google_review_url text,
  rastrear_cliques boolean not null default true,
  delay_horas_padrao integer,
  automacao_atendimento_concluido_ativa boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reputacao_config enable row level security;
grant select, insert, update, delete on public.reputacao_config to service_role;

alter table public.pesquisas
  add column tracking_token text unique,
  add column tracking_token_expira_em timestamptz,
  add column clicado_em timestamptz;

alter table public.pesquisas drop constraint pesquisas_status_check;
alter table public.pesquisas add constraint pesquisas_status_check
  check (status in ('pendente', 'enviada', 'respondida', 'clicada', 'falhou', 'expirada', 'cancelada'));
