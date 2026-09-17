-- ============================================================================
-- CRM OdontoMinas — V19: Campanhas (módulo estratégico)
-- Data: 2026-09-16
--
-- "Ferramentas → Campanhas" deixa de ser inexistente e vira o centro
-- estratégico de marketing/conversão da clínica — distinto de Disparo
-- (execução operacional de mensagem, renomeado na v18) e de Funil
-- (máquina de estado fixa da conversa, sem mudança aqui).
--
-- Reaproveita o que já existe: `audiencias` (motor de público, Fase A de
-- Disparos) por `audiencia_id`; `agentes_ia` por `agente_ia_id`;
-- `atendentes` pra responsável e trilha de auditoria; `pacientes.utm_*`/
-- `origem_lead`/`gclid`/`fbclid` (v14, Pixel) — só completa com `utm_term`,
-- `campanha_id` e `landing_page`. `disparos` ganha `campanha_id` (1
-- campanha → vários disparos, relação por FK, nunca duplicando a lógica de
-- envio).
--
-- `objetivo`/`tipo` são texto livre (sem CHECK): o catálogo sugerido vive em
-- código (`src/lib/campanhas.ts`), pra dar pra adicionar opção nova sem
-- migração. `status` tem CHECK porque é um conjunto fechado por design
-- (rascunho/agendada/ativa/pausada/concluida/cancelada — nomes em
-- português, consistente com o resto do schema; mapeiam 1:1 pros
-- draft/scheduled/active/paused/completed/cancelled do briefing original).
--
-- Sem tabela de métricas: todo número do dashboard (leads, respostas,
-- CPL/CPA/CAC/ROAS) é calculado ao vivo em `src/lib/campanha-metricas.ts`,
-- mesmo padrão de `src/lib/relatorios.ts` — evita uma 2ª fonte de verdade
-- que precisa de invalidação.
--
-- `campanha_eventos` é o log estruturado dos 5 marcos do funil (new_lead,
-- qualified_lead, appointment_booked, appointment_attended,
-- treatment_closed) — não um evento por mensagem (isso já dá pra contar
-- direto em `conversas`/`mensagens` filtrando por `campanha_id`). A unique
-- key (campanha_id, paciente_id, tipo) é a idempotência pedida no
-- briefing: mesmo padrão de dedup atômico já usado no Pixel
-- (`agentes-pixel.ts`), nunca duplica o mesmo marco pro mesmo paciente.
--
-- `appointment_attended`/`treatment_closed` nascem só por registro manual
-- (painel) — não existe canal automático pra isso hoje (ControleODONTO
-- ainda não tem credencial real, ver `docs/integrations/controle-odonto.md`).
-- Nunca inventar receita: `valor` só é preenchido quando alguém registra de
-- verdade.
--
-- Rodar depois da v18.
-- ============================================================================

create table public.campanhas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,

  nome text not null,
  descricao text,
  responsavel_id uuid references public.atendentes (id) on delete set null,

  objetivo text not null,
  tipo text not null,
  especialidade text,

  status text not null default 'rascunho'
    check (status in ('rascunho', 'agendada', 'ativa', 'pausada', 'concluida', 'cancelada')),
  data_inicio date,
  data_fim date,

  audiencia_id uuid references public.audiencias (id) on delete set null,
  agente_ia_id uuid references public.agentes_ia (id) on delete set null,

  -- {leads?, respostas?, agendamentos?, comparecimentos?, fechamentos?, receita?, cpa?, cpl?, roas?} — nenhuma obrigatória.
  metas jsonb not null default '{}'::jsonb,

  dominio text,
  slug text,
  url_final text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,

  meta_ads_campaign_id text,
  google_ads_campaign_id text,
  investimento_planejado numeric,
  investimento_real numeric,

  template_origem text,

  criado_por uuid references public.atendentes (id) on delete set null,
  atualizado_por uuid references public.atendentes (id) on delete set null,
  iniciado_por uuid references public.atendentes (id) on delete set null,
  pausado_por uuid references public.atendentes (id) on delete set null,
  encerrado_por uuid references public.atendentes (id) on delete set null,
  cancelado_por uuid references public.atendentes (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  iniciado_em timestamptz,
  pausado_em timestamptz,
  encerrado_em timestamptz,
  cancelado_em timestamptz
);
create index campanhas_clinica_status_idx on public.campanhas (clinica_id, status);

create table public.campanha_canais (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas (id) on delete cascade,
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  canal text not null,
  created_at timestamptz not null default now(),
  unique (campanha_id, canal)
);
create index campanha_canais_campanha_idx on public.campanha_canais (campanha_id);

create table public.campanha_eventos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  campanha_id uuid not null references public.campanhas (id) on delete cascade,
  paciente_id uuid references public.pacientes (id) on delete set null,
  conversa_id uuid references public.conversas (id) on delete set null,
  tipo text not null
    check (tipo in ('new_lead', 'qualified_lead', 'appointment_booked', 'appointment_attended', 'treatment_closed')),
  valor numeric,
  metadata jsonb not null default '{}'::jsonb,
  registrado_por uuid references public.atendentes (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (campanha_id, paciente_id, tipo)
);
create index campanha_eventos_campanha_tipo_idx on public.campanha_eventos (campanha_id, tipo);

alter table public.disparos
  add column if not exists campanha_id uuid references public.campanhas (id) on delete set null;
create index if not exists disparos_campanha_idx on public.disparos (campanha_id);

alter table public.pacientes
  add column if not exists campanha_id uuid references public.campanhas (id) on delete set null,
  add column if not exists utm_term text,
  add column if not exists landing_page text;
create index if not exists pacientes_campanha_idx on public.pacientes (campanha_id);

alter table public.campanhas enable row level security;
alter table public.campanha_canais enable row level security;
alter table public.campanha_eventos enable row level security;

grant select, insert, update, delete on public.campanhas to service_role;
grant select, insert, update, delete on public.campanha_canais to service_role;
grant select, insert, update, delete on public.campanha_eventos to service_role;

-- Verificação rápida (opcional):
--   select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('campanhas', 'campanha_canais', 'campanha_eventos')
--   order by table_name;
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name in ('disparos', 'pacientes') and column_name = 'campanha_id';
