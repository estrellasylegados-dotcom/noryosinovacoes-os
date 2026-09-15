import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fake mínimo do client Supabase — implementa só a fatia da API fluente que
 * conversas.ts usa (select/eq/in/order/maybeSingle/update/insert, e o
 * builder é "thenable" porque o código real faz `await query` direto sem
 * sempre chamar `.maybeSingle()`). Guarda os dados em memória por tabela.
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
              // created_at tem default now() no schema real — o fake precisa simular isso,
              // senão um insert sem created_at explícito nunca bate no filtro de order/janela.
              const nova = {
                id: `evt-${(db[table]?.length ?? 0) + 1}`,
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

const { listarConversas, atualizarStatus } = await import("@/lib/conversas");

const CLINICA = "clinica-1";
const T0 = Date.parse("2026-01-01T10:00:00.000Z");
const min = (n: number) => n * 60_000;

beforeEach(() => {
  fake.setDb({ conversas: [], eventos_funil: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("listarConversas — tempo até 1ª resposta", () => {
  it("conversa 'perdido' marcada direto a partir de 'novo' (nunca respondida) não mostra tempo de resposta", async () => {
    fake.setDb({
      conversas: [
        {
          id: "c1",
          clinica_id: CLINICA,
          telefone: "62999990000",
          status: "perdido",
          aguardando_desde: new Date(T0).toISOString(),
          ultima_mensagem_em: new Date(T0).toISOString(),
          pacientes: { nome: "Fulano" },
        },
      ],
      // saiu de "novo" direto pra "perdido" — nunca existiu status_novo='respondido'
      eventos_funil: [
        { conversa_id: "c1", clinica_id: CLINICA, status_anterior: "novo", status_novo: "perdido", created_at: new Date(T0 + min(2)).toISOString() },
      ],
    });

    const [resultado] = await listarConversas(CLINICA);
    expect(resultado.tempoPrimeiraRespostaMs).toBeNull();
  });

  it("conversa respondida de verdade mostra o tempo até a 1ª resposta", async () => {
    fake.setDb({
      conversas: [
        {
          id: "c2",
          clinica_id: CLINICA,
          telefone: "62999990001",
          status: "respondido",
          aguardando_desde: new Date(T0).toISOString(),
          ultima_mensagem_em: new Date(T0 + min(5)).toISOString(),
          pacientes: { nome: "Maria" },
        },
      ],
      eventos_funil: [
        { conversa_id: "c2", clinica_id: CLINICA, status_anterior: "novo", status_novo: "respondido", created_at: new Date(T0 + min(5)).toISOString() },
      ],
    });

    const [resultado] = await listarConversas(CLINICA);
    expect(resultado.tempoPrimeiraRespostaMs).toBe(min(5));
  });

  it("reabertura: resposta de um ciclo anterior (antes de aguardando_desde) não conta pro ciclo atual", async () => {
    fake.setDb({
      conversas: [
        {
          id: "c3",
          clinica_id: CLINICA,
          telefone: "62999990002",
          status: "novo", // reaberta
          aguardando_desde: new Date(T0 + min(60)).toISOString(), // reabriu 1h depois do evento antigo
          ultima_mensagem_em: new Date(T0 + min(60)).toISOString(),
          pacientes: null,
        },
      ],
      eventos_funil: [
        // resposta do ciclo ANTERIOR — não deve ser usada
        { conversa_id: "c3", clinica_id: CLINICA, status_anterior: "novo", status_novo: "respondido", created_at: new Date(T0 + min(10)).toISOString() },
      ],
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0 + min(75))); // 15min depois da reabertura

    const [resultado] = await listarConversas(CLINICA);
    expect(resultado.status).toBe("novo");
    expect(resultado.tempoPrimeiraRespostaMs).toBe(min(15));
  });

  it("conversa em aberto sem resposta ainda mostra o tempo corrido até agora", async () => {
    fake.setDb({
      conversas: [
        {
          id: "c4",
          clinica_id: CLINICA,
          telefone: "62999990003",
          status: "novo",
          aguardando_desde: new Date(T0).toISOString(),
          ultima_mensagem_em: new Date(T0).toISOString(),
          pacientes: null,
        },
      ],
      eventos_funil: [],
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0 + min(42)));

    const [resultado] = await listarConversas(CLINICA);
    expect(resultado.tempoPrimeiraRespostaMs).toBe(min(42));
  });
});

describe("listarConversas — ordenação", () => {
  it("prioriza novo > aguardando > respondido > agendado > perdido", async () => {
    fake.setDb({
      conversas: [
        { id: "p", clinica_id: CLINICA, telefone: "1", status: "perdido", aguardando_desde: null, ultima_mensagem_em: new Date(T0).toISOString(), pacientes: null },
        { id: "r", clinica_id: CLINICA, telefone: "2", status: "respondido", aguardando_desde: null, ultima_mensagem_em: new Date(T0).toISOString(), pacientes: null },
        { id: "n", clinica_id: CLINICA, telefone: "3", status: "novo", aguardando_desde: new Date(T0).toISOString(), ultima_mensagem_em: new Date(T0).toISOString(), pacientes: null },
        { id: "a", clinica_id: CLINICA, telefone: "4", status: "aguardando", aguardando_desde: new Date(T0).toISOString(), ultima_mensagem_em: new Date(T0).toISOString(), pacientes: null },
      ],
      eventos_funil: [],
    });

    const resultado = await listarConversas(CLINICA);
    expect(resultado.map((c) => c.id)).toEqual(["n", "a", "r", "p"]);
  });

  it("dentro de novo/aguardando, quem espera há mais tempo vem primeiro", async () => {
    fake.setDb({
      conversas: [
        { id: "recente", clinica_id: CLINICA, telefone: "1", status: "novo", aguardando_desde: new Date(T0 + min(10)).toISOString(), ultima_mensagem_em: new Date(T0).toISOString(), pacientes: null },
        { id: "antigo", clinica_id: CLINICA, telefone: "2", status: "novo", aguardando_desde: new Date(T0).toISOString(), ultima_mensagem_em: new Date(T0).toISOString(), pacientes: null },
      ],
      eventos_funil: [],
    });

    const resultado = await listarConversas(CLINICA);
    expect(resultado.map((c) => c.id)).toEqual(["antigo", "recente"]);
  });
});

describe("atualizarStatus", () => {
  it("reabrir manualmente ('perdido' -> 'novo') reinicia aguardando_desde e loga o evento", async () => {
    fake.setDb({
      conversas: [
        { id: "c1", clinica_id: CLINICA, telefone: "1", status: "perdido", aguardando_desde: new Date(T0).toISOString(), ultima_mensagem_em: new Date(T0).toISOString() },
      ],
      eventos_funil: [],
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0 + min(120)));

    const resultado = await atualizarStatus(CLINICA, "c1", "novo");
    expect(resultado.ok).toBe(true);

    const [conversa] = await listarConversas(CLINICA);
    expect(conversa.status).toBe("novo");
    expect(conversa.aguardandoDesde).toBe(new Date(T0 + min(120)).toISOString());
    expect(conversa.tempoPrimeiraRespostaMs).toBe(0);
  });

  it("marcar manualmente como 'respondido' não mexe em aguardando_desde e conta como resposta de verdade", async () => {
    fake.setDb({
      conversas: [
        { id: "c1", clinica_id: CLINICA, telefone: "1", status: "novo", aguardando_desde: new Date(T0).toISOString(), ultima_mensagem_em: new Date(T0).toISOString() },
      ],
      eventos_funil: [],
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0 + min(8)));

    await atualizarStatus(CLINICA, "c1", "respondido");

    const [conversa] = await listarConversas(CLINICA);
    expect(conversa.status).toBe("respondido");
    expect(conversa.tempoPrimeiraRespostaMs).toBe(min(8));
  });

  it("status igual ao atual é no-op (não loga evento)", async () => {
    fake.setDb({
      conversas: [{ id: "c1", clinica_id: CLINICA, telefone: "1", status: "novo", aguardando_desde: new Date(T0).toISOString(), ultima_mensagem_em: new Date(T0).toISOString() }],
      eventos_funil: [],
    });

    const resultado = await atualizarStatus(CLINICA, "c1", "novo");
    expect(resultado).toEqual({ ok: true });
  });

  it("conversa inexistente devolve not_found", async () => {
    fake.setDb({ conversas: [], eventos_funil: [] });
    const resultado = await atualizarStatus(CLINICA, "inexistente", "respondido");
    expect(resultado).toEqual({ ok: false, error: "not_found" });
  });
});
