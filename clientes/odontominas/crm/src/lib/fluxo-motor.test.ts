import { describe, expect, it } from "vitest";
import { processarNo, resolverVariaveisFluxo, type ContadoresNo } from "@/lib/fluxo-motor";
import type { FluxoDefinicao } from "@/lib/fluxo-tipos";

const PACIENTE = { nome: "Maria Silva", telefone: "5561999998888" };
const SEM_VISITAS: ContadoresNo = { visitas: 0, tentativasInvalidas: 0 };
const AGORA = new Date("2026-09-17T12:00:00.000Z");

function def(nodes: FluxoDefinicao["nodes"]): FluxoDefinicao {
  return { nodes, edges: [], config: {} };
}

describe("resolverVariaveisFluxo", () => {
  it("resolve {nome}/{primeiro_nome}/{telefone} igual resolverVariaveis", () => {
    expect(resolverVariaveisFluxo("Oi {primeiro_nome}!", {}, PACIENTE)).toBe("Oi Maria!");
  });

  it("resolve variável custom do fluxo", () => {
    expect(resolverVariaveisFluxo("Especialidade: {especialidade}", { especialidade: "Ortodontia" }, PACIENTE)).toBe(
      "Especialidade: Ortodontia"
    );
  });

  it("variável custom desconhecida vira vazio, nunca undefined", () => {
    expect(resolverVariaveisFluxo("Unidade: {unidade}.", {}, PACIENTE)).toBe("Unidade: .");
  });
});

describe("processarNo — inicio", () => {
  it("avança pro próximo nó, estado queued, aguardando_ate = agora", () => {
    const definicao = def([{ id: "inicio", tipo: "inicio", proximo: "msg" }]);
    const resultado = processarNo(definicao, "inicio", {}, { tipo: "avancar" }, PACIENTE, SEM_VISITAS, AGORA);
    expect(resultado).toMatchObject({ ok: true, proximoNoId: "msg", novoEstado: "queued", tipoEvento: "inicio" });
    if (resultado.ok) expect(resultado.aguardandoAte).toBe(AGORA.toISOString());
  });
});

describe("processarNo — mensagem", () => {
  it("resolve variável e devolve o texto pra enviar, avança e fica queued", () => {
    const definicao = def([{ id: "msg", tipo: "mensagem", texto: "Oi {primeiro_nome}!", proximo: "fim" }]);
    const resultado = processarNo(definicao, "msg", {}, { tipo: "avancar" }, PACIENTE, SEM_VISITAS, AGORA);
    expect(resultado).toMatchObject({
      ok: true,
      proximoNoId: "fim",
      novoEstado: "queued",
      mensagensParaEnviar: ["Oi Maria!"],
      tipoEvento: "mensagem_enviada",
    });
  });
});

describe("processarNo — espera", () => {
  it("não manda mensagem, avança no_atual pro próximo, waiting_time com aguardando_ate calculado", () => {
    const definicao = def([{ id: "espera", tipo: "espera", duracaoSegundos: 120, proximo: "fim" }]);
    const resultado = processarNo(definicao, "espera", {}, { tipo: "avancar" }, PACIENTE, SEM_VISITAS, AGORA);
    expect(resultado).toMatchObject({ ok: true, proximoNoId: "fim", novoEstado: "waiting_time", mensagensParaEnviar: [] });
    if (resultado.ok) expect(resultado.aguardandoAte).toBe(new Date(AGORA.getTime() + 120_000).toISOString());
  });
});

describe("processarNo — condicao", () => {
  const definicao = def([
    { id: "cond", tipo: "condicao", variavel: "quente", operador: "igual", valor: "sim", seVerdadeiro: "a", seFalso: "b" },
  ]);

  it("avança pro seVerdadeiro quando a condição bate", () => {
    const resultado = processarNo(definicao, "cond", { quente: "sim" }, { tipo: "avancar" }, PACIENTE, SEM_VISITAS, AGORA);
    expect(resultado).toMatchObject({ ok: true, proximoNoId: "a" });
  });

  it("avança pro seFalso quando não bate", () => {
    const resultado = processarNo(definicao, "cond", { quente: "nao" }, { tipo: "avancar" }, PACIENTE, SEM_VISITAS, AGORA);
    expect(resultado).toMatchObject({ ok: true, proximoNoId: "b" });
  });

  it("operador existe: falso quando a variável nunca foi setada", () => {
    const def2 = def([{ id: "cond", tipo: "condicao", variavel: "x", operador: "existe", seVerdadeiro: "a", seFalso: "b" }]);
    const resultado = processarNo(def2, "cond", {}, { tipo: "avancar" }, PACIENTE, SEM_VISITAS, AGORA);
    expect(resultado).toMatchObject({ proximoNoId: "b" });
  });
});

describe("processarNo — finalizar", () => {
  it("marca completed, sem próximo nó", () => {
    const definicao = def([{ id: "fim", tipo: "finalizar", motivo: "atendimento concluído" }]);
    const resultado = processarNo(definicao, "fim", {}, { tipo: "avancar" }, PACIENTE, SEM_VISITAS, AGORA);
    expect(resultado).toMatchObject({ ok: true, proximoNoId: null, novoEstado: "completed", motivoFinalizacao: "atendimento concluído" });
  });
});

describe("processarNo — menu", () => {
  const definicao = def([
    {
      id: "menu",
      tipo: "menu",
      texto: "1 Agendar\n2 Valores",
      opcoes: [
        { valor: "agendar", rotulos: ["1", "agendar", "quero agendar"], proximo: "agenda" },
        { valor: "valores", rotulos: ["2", "valores"], proximo: "precos" },
      ],
      timeoutSegundos: 3600,
      proximoTimeout: "timeout_no",
      mensagemInvalida: "Não entendi, {primeiro_nome}. Digite 1 ou 2.",
      maxTentativasInvalidas: 2,
    },
  ]);

  it("1ª vez (avancar): manda o texto do menu, fica waiting_input no próprio nó, aguardando_ate = timeout", () => {
    const resultado = processarNo(definicao, "menu", {}, { tipo: "avancar" }, PACIENTE, SEM_VISITAS, AGORA);
    expect(resultado).toMatchObject({
      ok: true,
      proximoNoId: "menu",
      novoEstado: "waiting_input",
      mensagensParaEnviar: ["1 Agendar\n2 Valores"],
      tipoEvento: "menu_enviado",
    });
    if (resultado.ok) expect(resultado.aguardandoAte).toBe(new Date(AGORA.getTime() + 3_600_000).toISOString());
  });

  it("menu sem timeoutSegundos: aguardando_ate fica null (espera indefinida)", () => {
    const semTimeout = def([{ id: "menu", tipo: "menu", texto: "Escolha", opcoes: [{ valor: "a", rotulos: ["a"], proximo: "x" }] }]);
    const resultado = processarNo(semTimeout, "menu", {}, { tipo: "avancar" }, PACIENTE, SEM_VISITAS, AGORA);
    expect(resultado.ok && resultado.aguardandoAte).toBeNull();
  });

  it.each([
    ["1", "agendar"],
    ["01", "agendar"],
    ["Agendar", "agendar"],
    ["  quero agendar  ", "agendar"],
    ["2", "valores"],
  ])('resposta "%s" casa com a opção "%s" e avança pro proximo dela', (resposta, valorEsperado) => {
    const resultado = processarNo(definicao, "menu", {}, { tipo: "resposta_texto", texto: resposta }, PACIENTE, SEM_VISITAS, AGORA);
    const opcao = definicao.nodes[0].tipo === "menu" ? definicao.nodes[0].opcoes.find((o) => o.valor === valorEsperado) : undefined;
    expect(resultado).toMatchObject({ ok: true, proximoNoId: opcao?.proximo, novoEstado: "queued", tipoEvento: "menu_respondido" });
  });

  it("resposta que não casa: reenvia mensagem de erro, permanece no mesmo nó, não é a última tentativa ainda", () => {
    const resultado = processarNo(definicao, "menu", {}, { tipo: "resposta_texto", texto: "blablabla" }, PACIENTE, SEM_VISITAS, AGORA);
    expect(resultado).toMatchObject({
      ok: true,
      proximoNoId: "menu",
      novoEstado: "waiting_input",
      mensagensParaEnviar: ["Não entendi, Maria. Digite 1 ou 2."],
      tipoEvento: "menu_invalido",
    });
  });

  it("tentativas inválidas esgotadas (maxTentativasInvalidas=2): cai no fallback proximoTimeout", () => {
    const resultado = processarNo(
      definicao,
      "menu",
      {},
      { tipo: "resposta_texto", texto: "???" },
      PACIENTE,
      { visitas: 0, tentativasInvalidas: 1 },
      AGORA
    );
    expect(resultado).toMatchObject({ ok: true, proximoNoId: "timeout_no", novoEstado: "queued", tipoEvento: "menu_tentativas_invalidas_esgotadas" });
  });

  it("timeout vencido: avança pro proximoTimeout configurado", () => {
    const resultado = processarNo(definicao, "menu", {}, { tipo: "timeout" }, PACIENTE, SEM_VISITAS, AGORA);
    expect(resultado).toMatchObject({ ok: true, proximoNoId: "timeout_no", novoEstado: "queued", tipoEvento: "menu_timeout" });
  });

  it("timeout sem proximoTimeout configurado: transfere pra humano", () => {
    const semFallback = def([{ id: "menu", tipo: "menu", texto: "Escolha", opcoes: [{ valor: "a", rotulos: ["a"], proximo: "x" }] }]);
    const resultado = processarNo(semFallback, "menu", {}, { tipo: "timeout" }, PACIENTE, SEM_VISITAS, AGORA);
    expect(resultado).toMatchObject({ ok: true, proximoNoId: null, novoEstado: "transferred" });
  });

  it("resposta inválida sem mensagemInvalida configurada usa o texto padrão", () => {
    const semMsg = def([{ id: "menu", tipo: "menu", texto: "Escolha", opcoes: [{ valor: "a", rotulos: ["a"], proximo: "x" }] }]);
    const resultado = processarNo(semMsg, "menu", {}, { tipo: "resposta_texto", texto: "?" }, PACIENTE, SEM_VISITAS, AGORA);
    expect(resultado.ok && resultado.mensagensParaEnviar[0]).toContain("Não consegui identificar");
  });
});

describe("processarNo — loop", () => {
  it("recusa processar quando já bateu o teto de visitas (loop_maximo_excedido)", () => {
    const definicao = def([{ id: "msg", tipo: "mensagem", texto: "oi", proximo: "msg" }]);
    const resultado = processarNo(definicao, "msg", {}, { tipo: "avancar" }, PACIENTE, { visitas: 3, tentativasInvalidas: 0 }, AGORA);
    expect(resultado).toEqual({ ok: false, erro: "loop_maximo_excedido" });
  });

  it("nó inexistente: erro estruturado, não lança exceção", () => {
    const definicao = def([{ id: "a", tipo: "finalizar" }]);
    const resultado = processarNo(definicao, "nao_existe", {}, { tipo: "avancar" }, PACIENTE, SEM_VISITAS, AGORA);
    expect(resultado).toEqual({ ok: false, erro: "no_nao_encontrado:nao_existe" });
  });
});
