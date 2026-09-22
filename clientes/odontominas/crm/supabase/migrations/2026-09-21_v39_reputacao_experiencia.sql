-- CRM OdontoMinas — V39: Experiência do Paciente / Recuperação de Experiência
-- Aditiva. Reutiliza pesquisas, fluxos, alertas, auditoria e horário já existentes.

alter table public.reputacao_config
  add column if not exists pesquisa_ativa boolean not null default false,
  add column if not exists pesquisa_delay_minutos integer not null default 30 check (pesquisa_delay_minutos >= 0),
  add column if not exists google_ativo boolean not null default false,
  add column if not exists google_delay_minutos integer not null default 120 check (google_delay_minutos >= 0),
  add column if not exists alerta_recuperacao_ativo boolean not null default true;

-- Ocorrência é separada do paciente: o mesmo paciente pode encerrar novos atendimentos no futuro.
create table if not exists public.reputacao_atendimentos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  origem text not null check (origem in ('etiqueta', 'controle_odonto', 'manual')),
  origem_referencia text not null,
  finalizado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (clinica_id, origem, origem_referencia)
);
create index if not exists reputacao_atendimentos_conversa_idx on public.reputacao_atendimentos (conversa_id, finalizado_em desc);

-- Fila da mesma infraestrutura de Fluxos: o worker existente entrega o convite
-- Google quando a conversa estiver livre. Não observa satisfação alguma.
create table if not exists public.reputacao_agendamentos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  atendimento_id uuid not null references public.reputacao_atendimentos(id) on delete cascade,
  tipo text not null check (tipo in ('google')),
  devido_em timestamptz not null,
  status text not null default 'pendente' check (status in ('pendente','processando','concluido','cancelado')),
  tentativas integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (atendimento_id, tipo)
);
create index if not exists reputacao_agendamentos_due_idx on public.reputacao_agendamentos (clinica_id, devido_em) where status='pendente';

create table if not exists public.recuperacao_experiencias (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  conversa_id uuid not null references public.conversas(id) on delete cascade,
  atendimento_id uuid references public.reputacao_atendimentos(id) on delete set null,
  pesquisa_id uuid unique references public.pesquisas(id) on delete set null,
  status text not null default 'aberto' check (status in ('aberto', 'em_tratativa', 'resolvido')),
  resposta_original text not null,
  motivo text check (motivo in ('atendimento', 'tempo_espera', 'comunicacao', 'procedimento', 'agendamento', 'cobranca', 'estrutura', 'outro')),
  responsavel_id uuid references public.atendentes(id) on delete set null,
  aberto_em timestamptz not null default now(),
  primeira_tratativa_em timestamptz,
  resolvido_em timestamptz,
  observacoes_internas text,
  solucao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recuperacao_experiencias_clinica_status_idx on public.recuperacao_experiencias (clinica_id, status, aberto_em desc);

alter table public.reputacao_atendimentos enable row level security;
alter table public.recuperacao_experiencias enable row level security;
alter table public.reputacao_agendamentos enable row level security;
grant select, insert, update, delete on public.reputacao_atendimentos to service_role;
grant select, insert, update, delete on public.recuperacao_experiencias to service_role;
grant select, insert, update, delete on public.reputacao_agendamentos to service_role;
