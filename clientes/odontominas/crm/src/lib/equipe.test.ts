import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesmo fake mínimo de conversas.test.ts (select/eq/in/order/maybeSingle/
 * update/insert) — equipe.ts lê `atendentes`, `conversas` (via listarConversas)
 * e `eventos_funil`, então o fake precisa cobrir as 3 tabelas.
 */
const { fake } = vi.hoisted(() => {
  function criarFakeSupabase() {
    let db: Record<string, Record<string, unknown>[]> = {};

    function setDb(novo: Record<string, Record<string, unknown>[]>) {
      db = Object.fromEntries(Object.entries(novo).map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
    }

    function builder(table: string) {
      const filtrosEq: [string, unknown][] = [];
      let filtroIn: [string, unknown[]] | null = null;
      let ordem: [string, boolean] | null = null;
      let modo: "select" | "update" | "insert" = "select";
      let payload: Record<string, unknown> | null = null;

      function linhas() {
        return (db[table] ?? []).filter((r) => {
          for (const [c, v] of filtrosEq) if (r[c] !== v) return false;
          if (filtroIn) {
            const [c, vs] = filtroIn;
            if (!vs.includes(r[c])) return false;
          }
          return true;
        });
      }

      const api: {
        select: (cols?: string) => typeof api;
        eq: (col: string, val: unknown) => typeof api;
        in: (col: string, vals: unknown[]) => typeof api;
        order: (col: string, opts?: { ascending?: boolean }) => typeof api;
        update: (patch: Record<string, unknown>) => typeof api;
        insert: (row: Record<string, unknown>) => typeof api;
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: null }>;
        then: (resolve: (v: { data: unknown; error: null }) => void, reject?: (e: unknown) => void) => void;
      } = {
        select() {
          modo = "select";
          return api;
        },
        eq(col, val) {
          filtrosEq.push([col, val]);
          return api;
        },
        in(col, vals) {
          filtroIn = [col, vals];
          return api;
        },
        order(col, opts = {}) {
          ordem = [col, opts.ascending !== false];
          return api;
        },
        update(patch) {
          modo = "update";
          payload = patch;
          return api;
        },
        insert(row) {
          modo = "insert";
          payload = row;
          return api;
        },
        async maybeSingle() {
          const r = linhas();
          return { data: r[0] ?? null, error: null };
        },
        then(resolve, reject) {
          try {
            if (modo === "select") {
              let r = linhas();
              if (ordem) {
                const [col, asc] = ordem;
                r = [...r].sort((a, b) => {
                  const av = String(a[col] ?? "");
                  const bv = String(b[col] ?? "");
                  if (av === bv) return 0;
                  return (av > bv ? 1 : -1) * (asc ? 1 : -1);
                });
              }
              resolve({ data: r, error: null });
            } else if (modo === "update") {
              for (const row of linhas()) Object.assign(row, payload);
              resolve({ data: null, error: null });
            } else if (modo === "insert") {
              const nova = {
                id: `row-${(db[table]?.length ?? 0) + 1}`,
                created_at: new Date().toISOString(),
                ...(payload ?? {}),
              };
              (db[table] ??= []).push(nova);
              resolve({ data: nova, error: null });
            }
          } catch (e) {
            reject?.(e);
          }
        },
      };

      return api;
    }

    return { client: { from: (table: string) => builder(table) }, setDb };
  }

  return { fake: criarFakeSupabase() };
});

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => fake.client,
}));

const { buscarStatsAtendentes } = await import("@/lib/equipe");

const CLINICA = "clinica-1";
const T0 = Date.parse("2026-09-15T12:00:00.000Z"); // 09:00 em Brasília — dentro do dia de hoje
const min = (n: number) => n * 60_000;

beforeEach(() => {
  fake.setDb({ atendentes: [], conversas: [], eventos_funil: [] });
  vi.useFakeTimers();
  vi.setSystemTime(new Date(T0 + min(30))); // "agora" um pouco depois de T0, mesmo dia em Brasília
});

afterEach(() => {
  vi.useRealTimers();
});

describe("buscarStatsAtendentes", () => {
  it("sem atendente cadastrado devolve lista vazia", async () => {
    expect(await buscarStatsAtendentes(CLINICA)).toEqual([]);
  });

  it("atendente sem nenhuma atividade aparece zerado", async () => {
    fake.setDb({
      atendentes: [{ id: "a1", clinica_id: CLINICA, nome: "Ana", usuario: "ana", papel: "atendente", perfil: "atendente", status: "active", ativo: true }],
      conversas: [],
      eventos_funil: [],
    });

    const [stat] = await buscarStatsAtendentes(CLINICA);
    expect(stat).toMatchObject({
      id: "a1",
      nome: "Ana",
      conversasAtendidas: 0,
      atendimentosHoje: 0,
      tempoMedioRespostaMs: null,
      ultimaAtividade: null,
    });
  });

  it("conta conversas distintas atendidas e tempo médio só das que ela respondeu de fato", async () => {
    fake.setDb({
      atendentes: [{ id: "a1", clinica_id: CLINICA, nome: "Ana", usuario: "ana", papel: "atendente", perfil: "atendente", status: "active", ativo: true }],
      conversas: [
        {
          id: "c1",
          clinica_id: CLINICA,
          telefone: "1",
          status: "respondido",
          aguardando_desde: new Date(T0).toISOString(),
          ultima_mensagem_em: new Date(T0).toISOString(),
        },
        {
          id: "c2",
          clinica_id: CLINICA,
          telefone: "2",
          status: "respondido",
          aguardando_desde: new Date(T0).toISOString(),
          ultima_mensagem_em: new Date(T0).toISOString(),
        },
      ],
      eventos_funil: [
        {
          conversa_id: "c1",
          clinica_id: CLINICA,
          status_anterior: "novo",
          status_novo: "respondido",
          motivo: "manual",
          atendente_id: "a1",
          created_at: new Date(T0 + min(10)).toISOString(),
        },
        {
          conversa_id: "c2",
          clinica_id: CLINICA,
          status_anterior: "novo",
          status_novo: "respondido",
          motivo: "manual",
          atendente_id: "a1",
          created_at: new Date(T0 + min(20)).toISOString(),
        },
      ],
    });

    const [stat] = await buscarStatsAtendentes(CLINICA);
    expect(stat.conversasAtendidas).toBe(2);
    expect(stat.atendimentosHoje).toBe(2);
    expect(stat.tempoMedioRespostaMs).toBe(min(15)); // média de 10min e 20min
    expect(stat.ultimaAtividade).toBe(new Date(T0 + min(20)).toISOString());
  });

  it("transição automática (sem atendente_id) não conta pra ninguém", async () => {
    fake.setDb({
      atendentes: [{ id: "a1", clinica_id: CLINICA, nome: "Ana", usuario: "ana", papel: "atendente", perfil: "atendente", status: "active", ativo: true }],
      conversas: [
        {
          id: "c1",
          clinica_id: CLINICA,
          telefone: "1",
          status: "respondido",
          aguardando_desde: new Date(T0).toISOString(),
          ultima_mensagem_em: new Date(T0).toISOString(),
        },
      ],
      eventos_funil: [
        {
          conversa_id: "c1",
          clinica_id: CLINICA,
          status_anterior: "novo",
          status_novo: "respondido",
          motivo: "primeira_resposta_automatica",
          atendente_id: null,
          created_at: new Date(T0 + min(5)).toISOString(),
        },
      ],
    });

    const [stat] = await buscarStatsAtendentes(CLINICA);
    expect(stat.conversasAtendidas).toBe(0);
    expect(stat.tempoMedioRespostaMs).toBeNull();
  });
});
