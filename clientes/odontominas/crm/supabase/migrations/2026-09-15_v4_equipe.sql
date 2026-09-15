-- ============================================================================
-- CRM OdontoMinas — V4: equipe (login por atendente + atendimento por secretária)
-- Data: 2026-09-15
--
-- Troca as 2 senhas compartilhadas (PAINEL_SENHA_ADMIN/PAINEL_SENHA_ATENDENTE,
-- ver andamento.md) por conta individual por atendente — pré-requisito pra
-- saber "quem atendeu o quê" no painel de Equipe (admin). Cada troca manual
-- de status no painel passa a gravar `atendente_id` em `eventos_funil`
-- (coluna nova); transição automática do webhook continua null (o sistema,
-- não uma pessoa, fez aquela).
--
-- Rodar uma vez no SQL Editor do projeto Supabase `odontominas-crm`, depois
-- da v1/v2/v3.
-- ============================================================================

create table if not exists public.atendentes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nome text not null,
  usuario text not null,
  senha_hash text not null,
  papel text not null check (papel in ('admin', 'atendente')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinica_id, usuario)
);

alter table public.eventos_funil
  add column if not exists atendente_id uuid references public.atendentes (id) on delete set null;

create index if not exists atendentes_clinica_idx on public.atendentes (clinica_id);
create index if not exists eventos_funil_atendente_idx on public.eventos_funil (atendente_id);

alter table public.atendentes enable row level security;

-- Contas de demonstração (senha temporária, hash scrypt — ver src/lib/senha.ts).
-- Trocar usuário/senha por pessoas reais da equipe antes de expor o painel
-- pra clínica de verdade (mesmo cuidado já registrado em andamento.md pras
-- senhas compartilhadas antigas). Senhas temporárias, só pra demo:
--   admin      / admin-temp-2026
--   recepcao1  / recepcao1-temp-2026
--   recepcao2  / recepcao2-temp-2026
insert into public.atendentes (clinica_id, nome, usuario, senha_hash, papel)
select id, 'Administração', 'admin',
  'b0c3fc63c7b23d9db020fbb262f1f6ef:8b28d8a658ba49345d332793886234d6e62bec31e9cddded9b98c7cfa9e3c7ed0e109e63cea2e3a6bf3fe0cce94233c38cfbba088a07d73cdebc58691e72602c',
  'admin'
from public.clinicas where slug = 'odontominas'
on conflict (clinica_id, usuario) do nothing;

insert into public.atendentes (clinica_id, nome, usuario, senha_hash, papel)
select id, 'Recepção 1', 'recepcao1',
  '67e50dbc256f6eb3aef6e709cdce3dd2:79cde91394b3326a37083d7a6e69867d89d4ce83a8bd41e1f8769f9afa03ec9c541b463abc2a6cf716cbb970d3e5d6ca117cd0cdbd383600589698c2c1ea9e1f',
  'atendente'
from public.clinicas where slug = 'odontominas'
on conflict (clinica_id, usuario) do nothing;

insert into public.atendentes (clinica_id, nome, usuario, senha_hash, papel)
select id, 'Recepção 2', 'recepcao2',
  '84a60cc60dd773b7a2739e1371e3f28b:e8d84779929b4ec5d35e45db92a59a4e8199110ac41b24a3cb25a5c5d15d5b9df48b3bcb3c41fe79e8d32133e43d21a3879795b1976f4ebeb504c264ef05ac51',
  'atendente'
from public.clinicas where slug = 'odontominas'
on conflict (clinica_id, usuario) do nothing;

-- Verificação rápida (opcional):
--   select nome, usuario, papel, ativo from public.atendentes order by nome;
