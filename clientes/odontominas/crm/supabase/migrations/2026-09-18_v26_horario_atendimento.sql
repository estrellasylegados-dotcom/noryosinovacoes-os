-- ============================================================================
-- CRM OdontoMinas — V26: horário de atendimento por clínica
-- Data: 2026-09-18
--
-- Fundação reutilizável pro SLA futuro (tempo de primeira resposta, alertas
-- de atraso, filas, automações, Agente de IA, indicadores) — NÃO conecta em
-- nada disso ainda, é só a configuração.
--
-- Timezone é escalar por clínica (não muda por dia) — mora direto em
-- `clinicas`, mesmo lugar de `apelido_instancia` (v7). O horário em si é uma
-- tabela filha, 1 linha por PERÍODO (não por dia): isso é o que permite dois
-- intervalos no mesmo dia (ex. 08:00–12:00 e 14:00–18:00) sem migration nova
-- quando a UI ganhar suporte a isso — hoje a UI só escreve 1 período por dia,
-- mas o modelo já aguenta mais. "Fechado" = zero linhas pro dia; "sem
-- configuração nenhuma" = zero linhas pra clínica inteira (os dois casos são
-- distintos na leitura, ver src/lib/horario-atendimento.ts).
--
-- Exceção de data (feriado, horário especial) e calendário de feriados ficam
-- de fora de propósito (ver relatório da fatia) — o modelo não fecha a porta
-- pra isso: uma tabela `horario_atendimento_excecoes` (clinica_id, data,
-- periodos ou fechado) encaixaria depois sem alterar esta aqui.
--
-- Grant pra service_role incluído nesta mesma migração (mesmo cuidado de
-- v5/v6/v25: este projeto Supabase não tem default privileges no schema
-- public, todo objeto novo nasce sem grant).
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v1..v25.
-- ============================================================================

alter table public.clinicas
  add column if not exists timezone text not null default 'America/Sao_Paulo';

create table if not exists public.horario_atendimento_periodos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  -- 0=domingo .. 6=sábado, mesma convenção de Date.prototype.getDay() —
  -- evita tabela de tradução entre banco e aplicação.
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fim time not null,
  created_at timestamptz not null default now(),
  check (hora_inicio < hora_fim)
);

create index if not exists horario_periodos_clinica_dia_idx on public.horario_atendimento_periodos (clinica_id, dia_semana);

alter table public.horario_atendimento_periodos enable row level security;

grant select, insert, update, delete on public.horario_atendimento_periodos to service_role;

-- Verificação rápida (opcional):
--   select timezone from public.clinicas where slug = 'odontominas';
--   select dia_semana, hora_inicio, hora_fim from public.horario_atendimento_periodos order by dia_semana, hora_inicio;
