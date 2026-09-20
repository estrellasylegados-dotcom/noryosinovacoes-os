import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let db: PGlite;
let clinica: string;
let canal: string;

async function one<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<T>(sql, params)).rows[0];
}

async function criarConversa() {
  return (await one("insert into conversas(clinica_id,canal_id) values($1,$2) returning id", [clinica, canal])).id as string;
}

async function atendente(nome: string, extras: Partial<{ clinica: string; status: string; ativo: boolean; perfil: string; permissoes: string[] | null }> = {}) {
  const r = await one(
    "insert into atendentes(clinica_id,nome,status,ativo,perfil,permissoes_customizadas) values($1,$2,$3,$4,$5,$6::jsonb) returning id",
    [extras.clinica ?? clinica, nome, extras.status ?? "active", extras.ativo ?? true, extras.perfil ?? "atendente", extras.permissoes === undefined ? null : JSON.stringify(extras.permissoes)]
  );
  return r.id as string;
}

async function distribuir(conversa: string) {
  return (await one("select auto_distribuir_conversa_round_robin($1,$2) r", [clinica, conversa])).r as { ok: boolean; assigned?: boolean; reason?: string; atendente_id?: string };
}

async function ativar() {
  await db.query(
    "insert into atendimento_config(clinica_id,auto_distribuicao_ativa) values($1,true) on conflict(clinica_id) do update set auto_distribuicao_ativa=true",
    [clinica]
  );
}

describe("distribuicao automatica — PostgreSQL", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role service_role; create role anon; create role authenticated;
      create table clinicas(id uuid primary key default gen_random_uuid());
      create table atendentes(id uuid primary key default gen_random_uuid(), clinica_id uuid references clinicas(id), nome text, status text default 'active', ativo boolean default true, perfil text default 'atendente', permissoes_customizadas jsonb);
      create table canais(id uuid primary key default gen_random_uuid(), clinica_id uuid references clinicas(id));
      create table conversas(id uuid primary key default gen_random_uuid(), clinica_id uuid references clinicas(id), canal_id uuid references canais(id), atribuido_a uuid references atendentes(id), atribuido_em timestamptz, updated_at timestamptz default now());
      create table conversa_eventos(id uuid primary key default gen_random_uuid(), clinica_id uuid references clinicas(id), conversa_id uuid references conversas(id), canal_id uuid references canais(id), tipo text, ator_id uuid references atendentes(id), de_atendente_id uuid references atendentes(id), para_atendente_id uuid references atendentes(id), motivo text, created_at timestamptz default now());
      create table auditoria_eventos(id uuid primary key default gen_random_uuid());
    `);
    await db.exec(readFileSync(resolve("supabase/migrations/2026-09-20_v38_distribuicao_automatica.sql"), "utf8"));
  }, 60000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.exec("truncate clinicas cascade;");
    clinica = (await one("insert into clinicas default values returning id")).id as string;
    canal = (await one("insert into canais(clinica_id) values($1) returning id", [clinica])).id as string;
  });

  it("desativada: conversa fica sem responsavel", async () => {
    const c = await criarConversa();
    expect(await distribuir(c)).toMatchObject({ ok: true, assigned: false, reason: "disabled" });
    expect((await one("select atribuido_a from conversas where id=$1", [c])).atribuido_a).toBeNull();
  });

  it("round-robin persistente: A, B, C, A", async () => {
    const ids = [await atendente("A"), await atendente("B"), await atendente("C")];
    await ativar();
    const conversas = await Promise.all([criarConversa(), criarConversa(), criarConversa(), criarConversa()]);
    const destinos = [];
    for (const c of conversas) destinos.push((await distribuir(c)).atendente_id);
    expect(destinos).toEqual([ids[0], ids[1], ids[2], ids[0]]);
  });

  it("ignora inativo, sem permissao customizada, outra clinica e perfil de plataforma", async () => {
    const outra = (await one("insert into clinicas default values returning id")).id as string;
    await atendente("Inativa", { status: "disabled" });
    await atendente("Sem permissao", { permissoes: [] });
    await atendente("Outra", { clinica: outra });
    await atendente("Noryos", { perfil: "noryos_admin" });
    const ok = await atendente("Elegivel", { permissoes: ["conversas.assumir"] });
    await ativar();
    expect(await distribuir(await criarConversa())).toMatchObject({ ok: true, assigned: true, atendente_id: ok });
  });

  it("conversa ja atribuida e retry nao redistribuem", async () => {
    const a = await atendente("A");
    await atendente("B");
    await ativar();
    const c = await criarConversa();
    expect((await distribuir(c)).atendente_id).toBe(a);
    expect(await distribuir(c)).toMatchObject({ ok: true, assigned: false, reason: "already_assigned" });
    expect((await one("select atribuido_a from conversas where id=$1", [c])).atribuido_a).toBe(a);
  });

  it("duas atribuicoes concorrentes ficam consistentes e SLA nao e tocado", async () => {
    const a = await atendente("A");
    const b = await atendente("B");
    await ativar();
    const c1 = await criarConversa();
    const c2 = await criarConversa();
    const [r1, r2] = await Promise.all([distribuir(c1), distribuir(c2)]);
    expect([r1.atendente_id, r2.atendente_id].sort()).toEqual([a, b].sort());
    const linhas = (await db.query<{ atribuido_a: string; atribuido_em: string | null }>("select atribuido_a, atribuido_em from conversas where id in ($1,$2)", [c1, c2])).rows;
    expect(linhas.every((l) => l.atribuido_a && l.atribuido_em)).toBe(true);
    expect(await one("select to_regclass('public.sla_eventos') as tabela")).toEqual({ tabela: null });
  });
});
