import { describe, expect, it } from "vitest";
import { contarAbasChat, filtrarConversasChat, normalizarTelefoneEntrada, type ConversaChat } from "@/lib/chat";

function conversa(parcial: Partial<ConversaChat> & { id: string }): ConversaChat {
  return {
    telefone: "5561999990000",
    pacienteId: null,
    pacienteNome: null,
    status: "novo",
    prioridade: "normal",
    naoLida: false,
    arquivada: false,
    atribuidoAId: null,
    atribuidoANome: null,
    ultimaMensagemEm: null,
    ultimaMensagemPreview: null,
    ultimaMensagemDirecao: null,
    etiquetas: [],
    ...parcial,
  };
}

describe("normalizarTelefoneEntrada", () => {
  it("adiciona DDI 55 num celular de 11 dígitos", () => {
    expect(normalizarTelefoneEntrada("61999998888")).toBe("5561999998888");
  });

  it("adiciona DDI 55 num fixo de 10 dígitos", () => {
    expect(normalizarTelefoneEntrada("6133334444")).toBe("556133334444");
  });

  it("aceita número já formatado, com parênteses/traço/espaço", () => {
    expect(normalizarTelefoneEntrada("(61) 99999-8888")).toBe("5561999998888");
  });

  it("mantém DDI 55 já informado sem duplicar", () => {
    expect(normalizarTelefoneEntrada("5561999998888")).toBe("5561999998888");
  });

  it("rejeita número curto demais ou vazio", () => {
    expect(normalizarTelefoneEntrada("12345")).toBeNull();
    expect(normalizarTelefoneEntrada("")).toBeNull();
    expect(normalizarTelefoneEntrada("abc")).toBeNull();
  });
});

describe("contarAbasChat", () => {
  const conversas: ConversaChat[] = [
    conversa({ id: "1", naoLida: true, status: "novo" }),
    conversa({ id: "2", naoLida: false, status: "respondido", atribuidoAId: "ana" }),
    conversa({ id: "3", naoLida: false, status: "perdido", arquivada: true }),
    conversa({ id: "4", naoLida: true, status: "agendado" }),
  ];

  it("conta cada aba ignorando arquivadas, exceto a própria contagem de arquivadas", () => {
    expect(contarAbasChat(conversas, "ana")).toEqual({
      todos: 3,
      nao_lidas: 2,
      concluidos: 2, // respondido + agendado (perdido está arquivada, não conta em "visíveis")
      atribuidos: 1,
      arquivadas: 1,
    });
  });

  it("sem atendente logado, 'atribuídos' fica zerado", () => {
    expect(contarAbasChat(conversas, null).atribuidos).toBe(0);
  });
});

describe("filtrarConversasChat", () => {
  const conversas: ConversaChat[] = [
    conversa({ id: "1", pacienteNome: "Maria Silva", telefone: "5561999990001", naoLida: true, status: "novo" }),
    conversa({
      id: "2",
      pacienteNome: "João Souza",
      telefone: "5561999990002",
      status: "respondido",
      prioridade: "urgente",
      atribuidoAId: "ana",
      etiquetas: [{ id: "et1", nome: "cliente_quente", cor: "#0d9488" }],
    }),
    conversa({ id: "3", pacienteNome: null, telefone: "5561999990003", status: "perdido", arquivada: true }),
  ];

  it("aba 'todos' exclui arquivadas", () => {
    const r = filtrarConversasChat(conversas, { aba: "todos", atendenteIdAtual: null });
    expect(r.map((c) => c.id)).toEqual(["1", "2"]);
  });

  it("aba 'arquivadas' mostra só as arquivadas", () => {
    const r = filtrarConversasChat(conversas, { aba: "arquivadas", atendenteIdAtual: null });
    expect(r.map((c) => c.id)).toEqual(["3"]);
  });

  it("aba 'nao_lidas'", () => {
    const r = filtrarConversasChat(conversas, { aba: "nao_lidas", atendenteIdAtual: null });
    expect(r.map((c) => c.id)).toEqual(["1"]);
  });

  it("aba 'concluidos' reaproveita STATUS_RESOLVIDOS do funil", () => {
    const r = filtrarConversasChat(conversas, { aba: "concluidos", atendenteIdAtual: null });
    expect(r.map((c) => c.id)).toEqual(["2"]);
  });

  it("aba 'atribuidos' só mostra o que é do atendente logado", () => {
    const r = filtrarConversasChat(conversas, { aba: "atribuidos", atendenteIdAtual: "ana" });
    expect(r.map((c) => c.id)).toEqual(["2"]);
    expect(filtrarConversasChat(conversas, { aba: "atribuidos", atendenteIdAtual: "outra" })).toEqual([]);
  });

  it("filtro de prioridade combina com a aba ativa", () => {
    const r = filtrarConversasChat(conversas, { aba: "todos", atendenteIdAtual: null, prioridade: "urgente" });
    expect(r.map((c) => c.id)).toEqual(["2"]);
  });

  it("filtro de etiqueta combina com a aba ativa", () => {
    const r = filtrarConversasChat(conversas, { aba: "todos", atendenteIdAtual: null, etiquetaId: "et1" });
    expect(r.map((c) => c.id)).toEqual(["2"]);
  });

  it("busca por nome, só a partir de 3 letras", () => {
    expect(filtrarConversasChat(conversas, { aba: "todos", atendenteIdAtual: null, busca: "jo" }).map((c) => c.id)).toEqual([
      "1",
      "2",
    ]); // menos de 3 letras: sem filtro
    expect(
      filtrarConversasChat(conversas, { aba: "todos", atendenteIdAtual: null, busca: "joão" }).map((c) => c.id)
    ).toEqual(["2"]);
  });

  it("busca por telefone (dígitos)", () => {
    const r = filtrarConversasChat(conversas, { aba: "todos", atendenteIdAtual: null, busca: "990001" });
    expect(r.map((c) => c.id)).toEqual(["1"]);
  });
});
