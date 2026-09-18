import { describe, expect, it } from "vitest";
import { salvarConfigReputacao } from "@/lib/reputacao-config";

/**
 * Só os ramos de validação (retornam ANTES de tocar o Supabase, mesmo
 * critério de I/O não-testado-direto do resto do projeto — ver comentário
 * de topo de fluxo-execucoes.ts). O caminho de sucesso depende de backend
 * real, não coberto aqui.
 */
describe("salvarConfigReputacao — validação", () => {
  it("recusa ativar sem link do Google", async () => {
    const resultado = await salvarConfigReputacao("clinica-1", {
      ativo: true,
      googleReviewUrl: null,
      rastrearCliques: true,
      delayHorasPadrao: null,
      automacaoAtendimentoConcluidoAtiva: false,
    });
    expect(resultado).toEqual({ ok: false, error: "url_ausente" });
  });

  it("recusa link que não é URL https válida", async () => {
    const resultado = await salvarConfigReputacao("clinica-1", {
      ativo: false,
      googleReviewUrl: "não é url",
      rastrearCliques: true,
      delayHorasPadrao: null,
      automacaoAtendimentoConcluidoAtiva: false,
    });
    expect(resultado).toEqual({ ok: false, error: "url_invalida" });
  });

  it("recusa link http:// (não https)", async () => {
    const resultado = await salvarConfigReputacao("clinica-1", {
      ativo: false,
      googleReviewUrl: "http://g.page/r/exemplo/review",
      rastrearCliques: true,
      delayHorasPadrao: null,
      automacaoAtendimentoConcluidoAtiva: false,
    });
    expect(resultado).toEqual({ ok: false, error: "url_invalida" });
  });

  it("recusa delay negativo ou fracionário", async () => {
    const base = { ativo: false, googleReviewUrl: null, rastrearCliques: true, automacaoAtendimentoConcluidoAtiva: false };
    expect(await salvarConfigReputacao("clinica-1", { ...base, delayHorasPadrao: -1 })).toEqual({ ok: false, error: "delay_invalido" });
    expect(await salvarConfigReputacao("clinica-1", { ...base, delayHorasPadrao: 2.5 })).toEqual({ ok: false, error: "delay_invalido" });
  });

  it("desativar o módulo não exige link (não trava quem só quer desligar)", async () => {
    const resultado = await salvarConfigReputacao("clinica-1", {
      ativo: false,
      googleReviewUrl: null,
      rastrearCliques: true,
      delayHorasPadrao: null,
      automacaoAtendimentoConcluidoAtiva: false,
    });
    expect(resultado.error).not.toBe("url_ausente");
  });
});
