import { describe, expect, it } from "vitest";
import { canonicalizarTelefoneBr, encontrarPorTelefoneEquivalente, variantesEquivalentesTelefoneBr } from "@/lib/telefone";

describe("canonicalizarTelefoneBr", () => {
  it("A. já com DDI e 9º dígito, idempotente", () => {
    expect(canonicalizarTelefoneBr("5561981925241")).toBe("5561981925241");
  });

  it("B. igual à entrada A (mesmo caso, nomeado conforme o pedido)", () => {
    expect(canonicalizarTelefoneBr("5561981925241")).toBe("5561981925241");
  });

  it("C. celular sem o 9º dígito (o bug real encontrado em produção) ganha o 9 de volta", () => {
    expect(canonicalizarTelefoneBr("556181925241")).toBe("5561981925241");
  });

  it("F. fixo brasileiro (local começa 2-5) nunca ganha 9º dígito", () => {
    expect(canonicalizarTelefoneBr("556132345678")).toBe("556132345678");
  });

  it("G. número estrangeiro (não começa com 55) nunca é tocado", () => {
    expect(canonicalizarTelefoneBr("12025551234")).toBe("12025551234");
  });

  it("I. canonicalizar duas vezes produz o mesmo resultado (idempotente)", () => {
    const uma = canonicalizarTelefoneBr("556181925241");
    expect(canonicalizarTelefoneBr(uma)).toBe(uma);
  });

  it("não mexe em string vazia ou não-BR de outro tamanho", () => {
    expect(canonicalizarTelefoneBr("")).toBe("");
    expect(canonicalizarTelefoneBr("123")).toBe("123");
  });
});

describe("variantesEquivalentesTelefoneBr", () => {
  it("celular canônico gera a variante legada (sem o 9º dígito)", () => {
    expect(variantesEquivalentesTelefoneBr("5561981925241")).toEqual(["5561981925241", "556181925241"]);
  });

  it("fixo brasileiro não gera variante nenhuma", () => {
    expect(variantesEquivalentesTelefoneBr("556132345678")).toEqual(["556132345678"]);
  });

  it("estrangeiro não gera variante nenhuma", () => {
    expect(variantesEquivalentesTelefoneBr("12025551234")).toEqual(["12025551234"]);
  });
});

describe("D/E/H — entrada humana (normalizarTelefoneEntrada) combinada com a canonicalização", () => {
  // Testados de ponta a ponta em chat.test.ts (a função que já faz DDI +
  // canonicalização); aqui só a canonicalização isolada sobre o formato que
  // normalizarTelefoneEntrada produziria antes de mexer no 9º dígito.
  it("D. local sem o 9 (após prepend de DDI) ganha o 9 de volta", () => {
    expect(canonicalizarTelefoneBr("556181925241")).toBe("5561981925241");
  });

  it("E. local já com 9 (após prepend de DDI) fica intacto", () => {
    expect(canonicalizarTelefoneBr("5561981925241")).toBe("5561981925241");
  });

  it("H. formatação com parênteses/traço, já convertida em dígitos, canonicaliza certo", () => {
    // "(61) 98192-5241" com DDI 55 na frente, só dígitos: 556181925241 (sem o 9, dígito perdido na digitação)
    expect(canonicalizarTelefoneBr("556181925241")).toBe("5561981925241");
  });
});

type Candidato = { id: string; telefone: string | null };

describe("encontrarPorTelefoneEquivalente (decisão de lookup, pura)", () => {
  it("CASO 1 — banco tem o canônico, entrada é a variante legada: encontra o existente", () => {
    const banco: Candidato[] = [{ id: "p1", telefone: "5561981925241" }];
    const achado = encontrarPorTelefoneEquivalente(banco, "5561981925241");
    expect(achado?.id).toBe("p1");
  });

  it("CASO 2 — banco tem a forma legada, entrada é a canônica: encontra o legado existente", () => {
    const banco: Candidato[] = [{ id: "p1", telefone: "556181925241" }];
    const achado = encontrarPorTelefoneEquivalente(banco, "5561981925241");
    expect(achado?.id).toBe("p1");
  });

  it("CASO 3 — nenhuma variante existente: não encontra nada (caller cria exatamente 1 novo)", () => {
    const achado = encontrarPorTelefoneEquivalente([], "5561981925241");
    expect(achado).toBeNull();
  });

  it("CASO 4 — encontrado por variante equivalente: nunca é null (caller não cria duplicado)", () => {
    const banco: Candidato[] = [{ id: "p1", telefone: "556181925241" }];
    const achado = encontrarPorTelefoneEquivalente(banco, "5561981925241");
    expect(achado).not.toBeNull();
  });

  it("prioriza o candidato já gravado na forma canônica quando os dois existem", () => {
    const banco: Candidato[] = [
      { id: "legado", telefone: "556181925241" },
      { id: "canonico", telefone: "5561981925241" },
    ];
    const achado = encontrarPorTelefoneEquivalente(banco, "5561981925241");
    expect(achado?.id).toBe("canonico");
  });
});
