import { describe, expect, it } from "vitest";
import { decidirTransicaoWebhook } from "@/lib/funil";
import { STATUS_ORDEM, type StatusConversa } from "@/lib/status";

describe("decidirTransicaoWebhook — mensagem da clínica (fromMe)", () => {
  it("1ª resposta: novo -> respondido, loga evento", () => {
    const decisao = decidirTransicaoWebhook("novo", true);
    expect(decisao).toEqual({
      statusNovo: "respondido",
      reabriu: false,
      evento: { statusAnterior: "novo", statusNovo: "respondido", motivo: "primeira_resposta_automatica" },
    });
  });

  it.each(["aguardando", "respondido", "agendado", "perdido"] as StatusConversa[])(
    "clínica escrevendo de novo em conversa '%s' não muda o status nem loga evento",
    (statusAtual) => {
      const decisao = decidirTransicaoWebhook(statusAtual, true);
      expect(decisao).toEqual({ statusNovo: statusAtual, reabriu: false, evento: null });
    }
  );
});

describe("decidirTransicaoWebhook — mensagem do paciente (!fromMe)", () => {
  it.each(["respondido", "agendado", "perdido"] as StatusConversa[])(
    "reabre conversa resolvida ('%s') de volta pra 'novo', reiniciando o relógio",
    (statusAtual) => {
      const decisao = decidirTransicaoWebhook(statusAtual, false);
      expect(decisao).toEqual({
        statusNovo: "novo",
        reabriu: true,
        evento: { statusAnterior: statusAtual, statusNovo: "novo", motivo: "nova_mensagem_reabriu" },
      });
    }
  );

  it.each(["novo", "aguardando"] as StatusConversa[])(
    "conversa já em aberto ('%s') não muda status nem loga evento de novo",
    (statusAtual) => {
      const decisao = decidirTransicaoWebhook(statusAtual, false);
      expect(decisao).toEqual({ statusNovo: statusAtual, reabriu: false, evento: null });
    }
  );
});

describe("decidirTransicaoWebhook — cobertura total", () => {
  it("toda combinação de status x fromMe devolve um statusNovo válido", () => {
    for (const status of STATUS_ORDEM) {
      for (const fromMe of [true, false]) {
        const decisao = decidirTransicaoWebhook(status, fromMe);
        expect(STATUS_ORDEM).toContain(decisao.statusNovo);
      }
    }
  });
});
