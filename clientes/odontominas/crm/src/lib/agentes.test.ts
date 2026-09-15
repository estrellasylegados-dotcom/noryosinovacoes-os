import { describe, expect, it } from "vitest";
import { decidirAtivarAgentePorEtiqueta, deveResponder, type AgenteIA } from "@/lib/agentes";

function criarAgente(overrides: Partial<AgenteIA> = {}): AgenteIA {
  return {
    id: "agente-1",
    clinicaId: "clinica-1",
    nome: "Agente 01",
    descricao: null,
    ativo: true,
    etiquetaGatilhoId: "etiqueta-1",
    provider: "google",
    modelo: "gemini-2.5-flash-lite",
    promptSistema: "",
    temperatura: 0.7,
    maxTokens: 700,
    maxMensagensResposta: 3,
    incluirHistorico: true,
    qtdHistorico: 10,
    pausarAoResponderHumano: true,
    tempoPausaMin: 480,
    mensagemTransferencia: null,
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
