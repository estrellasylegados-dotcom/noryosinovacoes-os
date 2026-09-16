import { describe, expect, it } from "vitest";
import {
  calcularTempoMedioRespostaMs,
  decidirAgenteElegivel,
  decidirAtivarAgentePorEtiqueta,
  dentroDoHorario,
  deveResponder,
  dividirMensagem,
  montarPromptSistema,
  type AgenteIA,
  type MensagemParaTempoResposta,
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
    modoPrompt: "avancado",
    persona: "",
    objetivo: "",
    fluxoTriagem: "",
    guardrails: "",
    tomVoz: "amigavel",
    usarEmojis: true,
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
    bufferMensagens: false,
    bufferSegundos: 8,
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

describe("decidirAgenteElegivel", () => {
  it("acha o agente ativo cuja etiqueta-gatilho está entre as etiquetas da conversa", () => {
    const agente = criarAgente();
    expect(decidirAgenteElegivel([agente], ["etiqueta-99", "etiqueta-1"])).toEqual(agente);
  });

  it("ignora agente pausado mesmo com a etiqueta certa", () => {
    const agente = criarAgente({ ativo: false });
    expect(decidirAgenteElegivel([agente], ["etiqueta-1"])).toBeNull();
  });

  it("devolve null quando nenhuma etiqueta da conversa bate com agente nenhum", () => {
    const agente = criarAgente();
    expect(decidirAgenteElegivel([agente], ["etiqueta-x", "etiqueta-y"])).toBeNull();
  });

  it("devolve null sem etiquetas", () => {
    expect(decidirAgenteElegivel([criarAgente()], [])).toBeNull();
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

describe("montarPromptSistema", () => {
  it("modo avançado usa o promptSistema cru, sem os campos estruturados", () => {
    const agente = criarAgente({
      modoPrompt: "avancado",
      promptSistema: "Prompt livre de sempre.",
      persona: "Isso não deveria aparecer",
    });
    expect(montarPromptSistema(agente, [])).toBe("Prompt livre de sempre.");
  });

  it("modo avançado ainda acrescenta o bloco de conhecimento no fim", () => {
    const agente = criarAgente({ modoPrompt: "avancado", promptSistema: "Prompt livre." });
    const resultado = montarPromptSistema(agente, [{ titulo: "Convênios", conteudo: "Bradesco e SulAmérica" }]);
    expect(resultado).toBe("Prompt livre.\n\nFatos que você pode usar pra responder (nunca invente além disso):\n- Convênios: Bradesco e SulAmérica");
  });

  it("modo simples compõe guardrails, persona, objetivo, fluxo e traços de personalidade", () => {
    const agente = criarAgente({
      modoPrompt: "simples",
      guardrails: "Nunca prometa resultado.",
      persona: "Você é a Ana, recepcionista da clínica.",
      objetivo: "Agendar avaliação.",
      fluxoTriagem: "Pergunte o motivo do contato primeiro.",
      tomVoz: "formal",
      usarEmojis: false,
    });
    const resultado = montarPromptSistema(agente, []);
    const posicaoGuardrails = resultado.indexOf("Nunca prometa resultado.");
    const posicaoPersona = resultado.indexOf("Você é a Ana");

    expect(posicaoGuardrails).toBeGreaterThanOrEqual(0);
    expect(posicaoPersona).toBeGreaterThan(posicaoGuardrails);
    expect(resultado).toContain("prioridade máxima");
    expect(resultado).toContain("Agendar avaliação.");
    expect(resultado).toContain("Pergunte o motivo do contato primeiro.");
    expect(resultado).toContain("formal e profissional");
    expect(resultado).toContain("Não use emojis.");
  });

  it("modo simples pula campos vazios sem deixar linhas em branco sobrando", () => {
    const agente = criarAgente({ modoPrompt: "simples", persona: "", guardrails: "", objetivo: "", fluxoTriagem: "" });
    const resultado = montarPromptSistema(agente, []);
    expect(resultado).not.toContain("prioridade máxima");
    expect(resultado.startsWith("Tom de voz:")).toBe(true);
  });

  it("modo simples também acrescenta o bloco de conhecimento", () => {
    const agente = criarAgente({ modoPrompt: "simples" });
    const resultado = montarPromptSistema(agente, [{ titulo: "Horário", conteudo: "Seg-sex 8h-18h" }]);
    expect(resultado).toContain("- Horário: Seg-sex 8h-18h");
  });
});

describe("calcularTempoMedioRespostaMs", () => {
  function msg(overrides: Partial<MensagemParaTempoResposta>): MensagemParaTempoResposta {
    return { conversaId: "conversa-1", direcao: "recebida", createdAt: "2026-09-16T12:00:00Z", geradaPorAgenteId: null, ...overrides };
  }

  it("sem nenhuma mensagem, devolve null", () => {
    expect(calcularTempoMedioRespostaMs([], "agente-1")).toBeNull();
  });

  it("calcula o delta entre recebida e a resposta do agente", () => {
    const mensagens = [
      msg({ createdAt: "2026-09-16T12:00:00Z", direcao: "recebida" }),
      msg({ createdAt: "2026-09-16T12:00:05Z", direcao: "enviada", geradaPorAgenteId: "agente-1" }),
    ];
    expect(calcularTempoMedioRespostaMs(mensagens, "agente-1")).toBe(5000);
  });

  it("ignora resposta enviada por um agente diferente", () => {
    const mensagens = [
      msg({ createdAt: "2026-09-16T12:00:00Z", direcao: "recebida" }),
      msg({ createdAt: "2026-09-16T12:00:05Z", direcao: "enviada", geradaPorAgenteId: "outro-agente" }),
    ];
    expect(calcularTempoMedioRespostaMs(mensagens, "agente-1")).toBeNull();
  });

  it("tira a média entre várias conversas", () => {
    const mensagens = [
      msg({ conversaId: "c1", createdAt: "2026-09-16T12:00:00Z", direcao: "recebida" }),
      msg({ conversaId: "c1", createdAt: "2026-09-16T12:00:04Z", direcao: "enviada", geradaPorAgenteId: "agente-1" }),
      msg({ conversaId: "c2", createdAt: "2026-09-16T12:00:00Z", direcao: "recebida" }),
      msg({ conversaId: "c2", createdAt: "2026-09-16T12:00:08Z", direcao: "enviada", geradaPorAgenteId: "agente-1" }),
    ];
    expect(calcularTempoMedioRespostaMs(mensagens, "agente-1")).toBe(6000);
  });

  it("uma resposta manual (sem agente) no meio não conta, mas não quebra o par seguinte", () => {
    const mensagens = [
      msg({ createdAt: "2026-09-16T12:00:00Z", direcao: "recebida" }),
      msg({ createdAt: "2026-09-16T12:00:03Z", direcao: "enviada", geradaPorAgenteId: null }),
      msg({ createdAt: "2026-09-16T12:05:00Z", direcao: "recebida" }),
      msg({ createdAt: "2026-09-16T12:05:02Z", direcao: "enviada", geradaPorAgenteId: "agente-1" }),
    ];
    expect(calcularTempoMedioRespostaMs(mensagens, "agente-1")).toBe(2000);
  });
});
