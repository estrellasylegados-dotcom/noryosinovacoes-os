import { describe, expect, it } from "vitest";
import {
  contarAbasChat,
  derivarStatusOperacional,
  filtrarConversasChat,
  normalizarTelefoneEntrada,
  ordenarConversasChat,
  type ConversaChat,
} from "@/lib/chat";

function conversa(parcial: Partial<ConversaChat> & { id: string }): ConversaChat {
  const base: ConversaChat = {
    telefone: "5561999990000",
    pacienteId: null,
    pacienteNome: null,
    status: "novo",
    prioridade: "normal",
    naoLida: false,
    mensagensNaoLidas: 0,
    arquivada: false,
    atribuidoAId: null,
    atribuidoANome: null,
    atribuidoEm: null,
    canalId: null,
    canalNome: null,
    finalizadaEm: null,
    statusOperacional: "nova",
    donoConversa: "humano",
    ultimaMensagemEm: null,
    ultimaMensagemPreview: null,
    ultimaMensagemDirecao: null,
    etiquetas: [],
    agenteAtivoId: null,
    ...parcial,
  };
  // statusOperacional é derivado — a fixture só o recalcula se o teste não o passou explicitamente.
  return parcial.statusOperacional ? base : { ...base, statusOperacional: derivarStatusOperacional(base.status, base.finalizadaEm) };
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

  it("D. celular BR digitado sem o 9º dígito (10 dígitos locais) ganha o 9 de volta", () => {
    expect(normalizarTelefoneEntrada("6181925241")).toBe("5561981925241");
  });

  it("E. celular BR digitado já com o 9º dígito fica intacto", () => {
    expect(normalizarTelefoneEntrada("61981925241")).toBe("5561981925241");
  });

  it("H. celular BR sem o 9, formatado com parênteses/traço", () => {
    expect(normalizarTelefoneEntrada("(61) 8192-5241")).toBe("5561981925241");
  });

  it("fixo BR de 10 dígitos locais nunca ganha 9º dígito", () => {
    expect(normalizarTelefoneEntrada("6132345678")).toBe("556132345678");
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
      novos: 1,
      sem_responsavel: 1, // a nº 1 (a nº 4 está finalizada e a nº 2 tem dona)
      aguardando_paciente: 1, // respondido sem finalização
      aguardando_atendente: 1,
      nao_lidas: 2,
      concluidos: 1, // só o agendado (perdido está arquivada, não conta em "visíveis")
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

  it("aba 'concluidos' = finalizada (finalizada_em, agendado ou perdido); respondido sem finalização é 'aguardando paciente'", () => {
    const comFinalizada = [...conversas, conversa({ id: "5", status: "respondido", finalizadaEm: "2026-09-19T10:00:00Z" })];
    const r = filtrarConversasChat(comFinalizada, { aba: "concluidos", atendenteIdAtual: null });
    expect(r.map((c) => c.id)).toEqual(["5"]);
    expect(filtrarConversasChat(conversas, { aba: "aguardando_paciente", atendenteIdAtual: null }).map((c) => c.id)).toEqual(["2"]);
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

describe("derivarStatusOperacional", () => {
  it("mapeia o funil pro estado operacional sem criar enum novo", () => {
    expect(derivarStatusOperacional("novo", null)).toBe("nova");
    expect(derivarStatusOperacional("aguardando", null)).toBe("aguardando_atendente");
    expect(derivarStatusOperacional("respondido", null)).toBe("aguardando_paciente");
    expect(derivarStatusOperacional("agendado", null)).toBe("finalizada");
    expect(derivarStatusOperacional("perdido", null)).toBe("finalizada");
  });

  it("finalizada_em vence o status: respondido + finalizada = finalizada", () => {
    expect(derivarStatusOperacional("respondido", "2026-09-19T10:00:00Z")).toBe("finalizada");
    expect(derivarStatusOperacional("novo", "2026-09-19T10:00:00Z")).toBe("finalizada");
  });
});

describe("caixa compartilhada — filtros por canal e responsável", () => {
  const conversas: ConversaChat[] = [
    conversa({ id: "a", canalId: "recepcao", atribuidoAId: "juliana", status: "aguardando" }),
    conversa({ id: "b", canalId: "recepcao", atribuidoAId: null, status: "novo" }),
    conversa({ id: "c", canalId: "comercial", atribuidoAId: "juliana", status: "respondido" }),
    conversa({ id: "d", canalId: "comercial", atribuidoAId: null, status: "novo" }),
  ];

  it("filtra por canal", () => {
    expect(filtrarConversasChat(conversas, { aba: "todos", atendenteIdAtual: null, canalId: "comercial" }).map((c) => c.id)).toEqual(["c", "d"]);
  });

  it("filtra por responsável e por 'sem responsável'", () => {
    expect(filtrarConversasChat(conversas, { aba: "todos", atendenteIdAtual: null, responsavelId: "juliana" }).map((c) => c.id)).toEqual(["a", "c"]);
    expect(filtrarConversasChat(conversas, { aba: "todos", atendenteIdAtual: null, responsavelId: "sem" }).map((c) => c.id)).toEqual(["b", "d"]);
  });

  it("combina canal + responsável + fila", () => {
    const r = filtrarConversasChat(conversas, { aba: "aguardando_atendente", atendenteIdAtual: null, canalId: "recepcao", responsavelId: "juliana" });
    expect(r.map((c) => c.id)).toEqual(["a"]);
  });

  it("fila 'sem responsável' ignora conversa finalizada", () => {
    const comFinalizada = [...conversas, conversa({ id: "e", atribuidoAId: null, status: "perdido" })];
    expect(filtrarConversasChat(comFinalizada, { aba: "sem_responsavel", atendenteIdAtual: null }).map((c) => c.id)).toEqual(["b", "d"]);
  });
});

describe("ordenarConversasChat", () => {
  const conversas: ConversaChat[] = [
    conversa({ id: "1", ultimaMensagemEm: "2026-09-19T10:00:00Z", atribuidoAId: "x" }),
    conversa({ id: "2", ultimaMensagemEm: "2026-09-19T12:00:00Z", atribuidoAId: null }),
    conversa({ id: "3", ultimaMensagemEm: "2026-09-19T11:00:00Z", atribuidoAId: null }),
  ];

  it("mais recentes / mais antigos", () => {
    expect(ordenarConversasChat(conversas, "recentes").map((c) => c.id)).toEqual(["2", "3", "1"]);
    expect(ordenarConversasChat(conversas, "antigos").map((c) => c.id)).toEqual(["1", "3", "2"]);
  });

  it("sem responsável primeiro (dentro do grupo, mais recente antes) e não muta a entrada", () => {
    expect(ordenarConversasChat(conversas, "sem_responsavel").map((c) => c.id)).toEqual(["2", "3", "1"]);
    expect(conversas.map((c) => c.id)).toEqual(["1", "2", "3"]);
  });
});
