import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** PostgreSQL isolado em memória: não lê .env, não conecta à Supabase, não envia mensagens. */
export async function criarBancoFluxosTeste() {
  const db = new PGlite();
  await db.exec(`
    create role service_role; create role anon; create role authenticated;
    create table clinicas(id uuid primary key default gen_random_uuid(), nome text default 'Clínica TESTE', timezone text default 'America/Sao_Paulo');
    create table pacientes(id uuid primary key default gen_random_uuid(), clinica_id uuid references clinicas(id), nome text, telefone text, opt_out_em timestamptz);
    create table atendentes(id uuid primary key default gen_random_uuid(), clinica_id uuid references clinicas(id), nome text, status text default 'active');
    create table campanhas(id uuid primary key default gen_random_uuid());
    create table conversas(id uuid primary key default gen_random_uuid(), clinica_id uuid references clinicas(id), paciente_id uuid references pacientes(id),
      agente_ativo_id uuid, atribuido_a uuid references atendentes(id), finalizada_em timestamptz, arquivada boolean default false,
      ultima_mensagem_em timestamptz, updated_at timestamptz default now());
    create table mensagens(id uuid primary key default gen_random_uuid(),clinica_id uuid references clinicas(id),conversa_id uuid references conversas(id),direcao text,
      enviada_por_atendente_id uuid references atendentes(id), created_at timestamptz default now());
    create table conversa_eventos(id uuid primary key default gen_random_uuid(),clinica_id uuid references clinicas(id),conversa_id uuid references conversas(id),tipo text,created_at timestamptz default now());
    create table notas_internas(id uuid primary key default gen_random_uuid(),clinica_id uuid references clinicas(id),conversa_id uuid references conversas(id),atendente_id uuid references atendentes(id),texto text);
  `);
  for (const file of ["2026-09-17_v20_fluxo_conversa_schema.sql", "2026-09-17_v23_automacao_eventos.sql", "2026-09-18_v33_kanban_oportunidades.sql", "2026-09-18_v34_kanban_responsavel.sql", "2026-09-19_v36_fluxos_comerciais.sql"]) {
    await db.exec(readFileSync(resolve("supabase/migrations", file), "utf8"));
  }
  return db;
}
