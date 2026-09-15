import { describe, expect, it } from "vitest";
import {
  decidirAtivarAgentePorEtiqueta,
  dentroDoHorario,
  deveResponder,
  dividirMensagem,
  type AgenteIA,
} from "@/lib/agentes";

function criarAgente(overrides: Partial<AgenteIA> = {}): AgenteIA {
  return {
    id: "agente-1",
    clinicaId: "clinica-1",
    nome: "Agente 01",
    descricao: null,
    ativo: true,
    etiquetaGatilhoId: "etiqueta-1",
    provider: "google",
    modelo: "gemini-flash-lite-latest",
    promptSistema: "",
    temperatura: 0.7,
    maxTokens: 700,
    maxMensagensResposta: 3,
    incluirHistorico: true,
    qtdHistorico: 10,
    pausarAoResponderHumano: true,
    tempoPausaMin: 480,
    mensagemTransferencia: null,
    responderApenasHorario: false,
    horarioInicio: null,
    horarioFim: null,
    maxCaracteresResposta: null,
    pausarAposConcluirFluxo: false,
    dividirEmMensagensCurtas: false,
    ativarTransferencia: false,
    notificarNumeros: null,
    notificarPedidoHumano: true,
    notificarFallback: false,
    notificarIntencaoCompra: false,
    notificarNovoLead: false,
    mensagemNotificacao: null,
    ...overrides,
  };
}

describe("decidirAtivarAgentePorEtiqueta", () => {
  it("acha o agente ativo cuja etiqueta-gatilho bate", () => {
    const agente = criarAgente();
    expect(decidirAtivarAgentePorEtiqueta([agente], "etiqueta-1")).toEqual(agente);
  });

  it("ignora agente pausado mesmo com a etiqueta certa", () => {
    const agente = criarAgente({ ativo: false });
    expect(decidirAtivarAgentePorEtiqueta([agente], "etiqueta-1")).toBeNull();
  });

  it("ignora agente com outra etiqueta-gatilho", () => {
    const agente = criarAgente({ etiquetaGatilhoId: "etiqueta-2" });
    expect(decidirAtivarAgentePorEtiqueta([agente], "etiqueta-1")).toBeNull();
  });

  it("devolve null se nenhum agente casa", () => {
    expect(decidirAtivarAgentePorEtiqueta([], "etiqueta-1")).toBeNull();
  });
});

describe("deveResponder", () => {
  const agora = new Date("2026-09-15T12:00:00Z");

  it("não responde mensagem da própria clínica (fromMe)", () => {
    expect(deveResponder({ agenteAtivoId: "agente-1", agentePausadoAte: null }, agora, true)).toBe(false);
  });

  it("não responde se não tem agente ativo na conversa", () => {
    expect(deveResponder({ agenteAtivoId: null, agentePausadoAte: null }, agora, false)).toBe(false);
  });

  it("responde com agente ativo, sem pausa e mensagem do paciente", () => {
    expect(deveResponder({ agenteAtivoId: "agente-1", agentePausadoAte: null }, agora, false)).toBe(true);
  });

  it("não responde enquanto a pausa (depois de humano responder) ainda não venceu", () => {
    const pausadoAte = new Date("2026-09-15T13:00:00Z").toISOString();
    expect(deveResponder({ agenteAtivoId: "agente-1", agentePausadoAte: pausadoAte }, agora, false)).toBe(false);
  });

  it("volta a responder depois que a pausa vence", () => {
    const pausadoAte = new Date("2026-09-15T11:00:00Z").toISOString();
    expect(deveResponder({ agenteAtivoId: "agente-1", agentePausadoAte: pausadoAte }, agora, false)).toBe(true);
  });
});

describe("dentroDoHorario", () => {
  it("sem horário configurado, responde a qualquer hora", () => {
    expect(dentroDoHorario("03:00", null, null)).toBe(true);
    expect(dentroDoHorario("23:59", null, null)).toBe(true);
  });

  it("dentro do horário configurado", () => {
    expect(dentroDoHorario("14:00", "08:00", "18:00")).toBe(true);
  });

  it.each(["07:59", "18:00", "23:00"])("fora do horário configurado (%s)", (hora) => {
    expect(dentroDoHorario(hora, "08:00", "18:00")).toBe(false);
  });

  it("limite inicial é inclusivo, limite final é exclusivo", () => {
    expect(dentroDoHorario("08:00", "08:00", "18:00")).toBe(true);
    expect(dentroDoHorario("18:00", "08:00", "18:00")).toBe(false);
  });
});

describe("dividirMensagem", () => {
  it("texto curto sem parágrafo vira um bloco só", () => {
    expect(dividirMensagem("Oi, tudo bem?", 3)).toEqual(["Oi, tudo bem?"]);
  });

  it("divide por parágrafo quando existe mais de um", () => {
    const texto = "Primeira parte.\n\nSegunda parte.\n\nTerceira parte.";
    expect(dividirMensagem(texto, 5)).toEqual(["Primeira parte.", "Segunda parte.", "Terceira parte."]);
  });

  it("sem parágrafo, divide por frase", () => {
    const texto = "Primeira frase. Segunda frase. Terceira frase.";
    expect(dividirMensagem(texto, 5)).toEqual(["Primeira frase.", "Segunda frase.", "Terceira frase."]);
  });

  it("respeita o teto de blocos, juntando o resto no último", () => {
    const texto = "Um. Dois. Três. Quatro. Cinco.";
    const resultado = dividirMensagem(texto, 2);
    expect(resultado).toHaveLength(2);
    expect(resultado[0]).toBe("Um.");
    expect(resultado[1]).toBe("Dois. Três. Quatro. Cinco.");
  });

  it("teto de 1 bloco devolve o texto inteiro", () => {
    const texto = "Um. Dois. Três.";
    expect(dividirMensagem(texto, 1)).toEqual([texto]);
  });
});
