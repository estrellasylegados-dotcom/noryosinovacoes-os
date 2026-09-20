/* eslint-disable @typescript-eslint/no-unused-vars -- stubs de teste ignoram argumentos de propósito */
/**
 * Supabase em memória só pros testes de roteamento (webhook/envio por canal).
 * Cobre APENAS o que o código sob teste usa: select/insert/update com eq/in/
 * is/or simples, maybeSingle/single e unicidade declarada por tabela.
 * Atomicidade de assumir/transferir NÃO é provada aqui (mock não prova isso):
 * ela é provada contra o banco real em scripts/e2e-canais-concorrencia.mjs.
 */

type Linha = Record<string, unknown>;
type Filtro = (l: Linha) => boolean;

export type FakeDb = {
  tables: Record<string, Linha[]>;
  client: { from: (t: string) => Builder; rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: null }> };
  rpcHandlers: Record<string, (args: Record<string, unknown>) => unknown>;
};

const DEFAULTS_PADRAO: Record<string, Linha> = {
  canais: { tipo: "whatsapp", provider: "evolution", status: "unknown", ativo: true, principal: false, credencial_ref: null },
};

/** unicidade: tabela → lista de colunas (todas não-nulas comparadas; null nunca conflita, igual ao Postgres). */
export function criarFakeDb(
  unicos: Record<string, string[][]> = {},
  iniciais: Record<string, Linha[]> = {},
  /** defaults de coluna (o Postgres real aplica; o fake precisa imitar): tabela → { coluna: valor } */
  defaults: Record<string, Linha> = DEFAULTS_PADRAO
): FakeDb {
  const tables: Record<string, Linha[]> = {};
  for (const [nome, linhas] of Object.entries(iniciais)) tables[nome] = linhas.map((l) => ({ ...l }));
  let seq = 0;
  const rpcHandlers: FakeDb["rpcHandlers"] = {};

  function tabela(nome: string): Linha[] {
    return (tables[nome] ??= []);
  }

  function from(nome: string): Builder {
    return new Builder(nome, tabela, () => `id-${++seq}`, unicos[nome] ?? [], defaults[nome] ?? {});
  }

  return {
    tables,
    rpcHandlers,
    client: {
      from,
      rpc: async (fn, args) => ({ data: rpcHandlers[fn] ? rpcHandlers[fn](args) : null, error: null }),
    },
  };
}

class Builder implements PromiseLike<{ data: unknown; error: { code: string; message: string } | null; count?: number | null }> {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private filtros: Filtro[] = [];
  private payload: Linha | Linha[] | null = null;
  private conflito: string[] = [];
  private retorna = false;
  private limite: number | null = null;
  private soUma = false;

  constructor(
    private nome: string,
    private tabela: (n: string) => Linha[],
    private novoId: () => string,
    private unicos: string[][],
    private defaults: Linha
  ) {}

  select(..._ignorados: unknown[]) {
    if (this.op === "insert" || this.op === "update") this.retorna = true;
    else this.op = "select";
    return this;
  }
  insert(p: Linha | Linha[]) {
    this.op = "insert";
    this.payload = p;
    return this;
  }
  update(p: Linha) {
    this.op = "update";
    this.payload = p;
    return this;
  }
  upsert(p: Linha | Linha[], opcoes?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = p;
    this.conflito = opcoes?.onConflict?.split(",").map((c) => c.trim()).filter(Boolean) ?? [];
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col: string, val: unknown) {
    this.filtros.push((l) => l[col] === val);
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filtros.push((l) => vals.includes(l[col]));
    return this;
  }
  is(col: string, val: null) {
    this.filtros.push((l) => (l[col] ?? null) === val);
    return this;
  }
  /** só `.not(col, "is", null)` (= "não é nulo") — o que o código sob teste usa. */
  not(col: string, op: string, val: null) {
    if (op === "is" && val === null) this.filtros.push((l) => (l[col] ?? null) !== null);
    return this;
  }
  order() {
    return this;
  }
  limit(n: number) {
    this.limite = n;
    return this;
  }
  maybeSingle() {
    this.soUma = true;
    return this;
  }
  single() {
    this.soUma = true;
    return this;
  }

  private executar(): { data: unknown; error: { code: string; message: string } | null; count?: number } {
    const linhas = this.tabela(this.nome);
    const casa = (l: Linha) => this.filtros.every((f) => f(l));

    if (this.op === "insert") {
      const novos = (Array.isArray(this.payload) ? this.payload : [this.payload as Linha]).map((p): Linha => ({ id: this.novoId(), ...this.defaults, ...p }));
      for (const novo of novos) {
        for (const cols of this.unicos) {
          if (cols.some((c) => novo[c] == null)) continue;
          if (linhas.some((l) => cols.every((c) => l[c] === novo[c]))) return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        linhas.push(novo);
      }
      return { data: this.soUma ? (novos[0] ?? null) : novos, error: null };
    }

    if (this.op === "upsert") {
      const novos = (Array.isArray(this.payload) ? this.payload : [this.payload as Linha]).map((p): Linha => ({ id: this.novoId(), ...this.defaults, ...p }));
      const salvos: Linha[] = [];
      for (const novo of novos) {
        const cols = this.conflito.length ? this.conflito : this.unicos[0] ?? [];
        const existente = cols.length ? linhas.find((l) => cols.every((c) => l[c] === novo[c])) : undefined;
        if (existente) {
          Object.assign(existente, novo);
          salvos.push(existente);
        } else {
          linhas.push(novo);
          salvos.push(novo);
        }
      }
      return { data: this.retorna ? (this.soUma ? (salvos[0] ?? null) : salvos) : null, error: null };
    }

    if (this.op === "update") {
      const alvo = linhas.filter(casa);
      for (const l of alvo) Object.assign(l, this.payload);
      return { data: this.retorna ? (this.soUma ? (alvo[0] ?? null) : alvo) : null, error: null };
    }

    if (this.op === "delete") {
      this.tabela(this.nome).splice(0, linhas.length, ...linhas.filter((l) => !casa(l)));
      return { data: null, error: null };
    }

    // Cópias, como o PostgREST: quem lê um snapshot não enxerga UPDATEs posteriores.
    let achadas = linhas.filter(casa).map((l) => ({ ...l }));
    if (this.limite !== null) achadas = achadas.slice(0, this.limite);
    return { data: this.soUma ? (achadas[0] ?? null) : achadas, error: null, count: achadas.length };
  }

  then<R1 = { data: unknown; error: { code: string; message: string } | null }, R2 = never>(
    ok?: ((v: { data: unknown; error: { code: string; message: string } | null; count?: number }) => R1 | PromiseLike<R1>) | null,
    err?: ((e: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.executar()).then(ok, err);
  }
}
