import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fake mínimo do client Supabase — implementa só a fatia que
 * `tentarReservarEnvio` usa: `update(...).eq(...).eq(...).is(coluna, null).select("id")`,
 * onde `select` é quem de fato "resolve" (o código real faz `await` na
 * cadeia inteira sem builder separado) — mesmo espírito do fake em
 * conversas.test.ts, encolhido pra só esta forma de query.
 */
const { fake } = vi.hoisted(() => {
  function criarFakeSupabase() {
    let conversas: Record<string, unknown>[] = [];

    function setDb(rows: Record<string, unknown>[]) {
      conversas = rows.map((r) => ({ ...r }));
    }

    function builder() {
      const filtrosEq: [string, unknown][] = [];
      const filtrosIsNull: string[] = [];
      let payload: Record<string, unknown> | null = null;

      const api = {
        update(patch: Record<string, unknown>) {
          payload = patch;
          return api;
        },
        eq(col: string, val: unknown) {
          filtrosEq.push([col, val]);
          return api;
        },
        is(col: string) {
          filtrosIsNull.push(col);
          return api;
        },
        async select() {
          const linhas = conversas.filter((r) => {
            for (const [c, v] of filtrosEq) if (r[c] !== v) return false;
            for (const c of filtrosIsNull) if (r[c] !== null && r[c] !== undefined) return false;
            return true;
          });
          for (const row of linhas) Object.assign(row, payload);
          return { data: linhas, error: null };
        },
      };

      return api;
    }

    return { client: { from: () => builder() }, setDb };
  }

  return { fake: criarFakeSupabase() };
});

vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => fake.client }));

const enviarEventoFacebookMock = vi.fn<(...args: unknown[]) => Promise<{ ok: boolean }>>(async () => ({ ok: true }));
vi.mock("@/lib/pixel-facebook", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/pixel-facebook")>();
  return { ...original, enviarEventoFacebook: (...args: unknown[]) => enviarEventoFacebookMock(...args) };
});

const enviarEventoGoogleAdsMock = vi.fn<(...args: unknown[]) => Promise<{ ok: boolean }>>(async () => ({ ok: true }));
vi.mock("@/lib/pixel-google-ads", () => ({
  enviarEventoGoogleAds: (...args: unknown[]) => enviarEventoGoogleAdsMock(...args),
}));

const { dispararPixelSeConfigurado, extrairAtribuicaoWebhook } = await import("@/lib/agentes-pixel");

function criarAgenteConfig(overrides: Record<string, unknown> = {}) {
  return {
    pixelAtivo: true,
    pixelFacebookPixelId: "pixel-123",
    pixelFacebookAccessToken: "token-abc",
    pixelGoogleCustomerId: null,
    pixelGoogleLoginCustomerId: null,
    pixelGoogleRefreshToken: null,
    pixelGoogleConversionActionNovoLead: null,
    pixelGoogleConversionActionQuente: null,
    pixelGoogleConversionActionAgendado: null,
    ...overrides,
  };
}

beforeEach(() => {
  fake.setDb([
    {
      id: "conversa-1",
      clinica_id: "clinica-1",
      pixel_novo_lead_enviado_em: null,
      pixel_quente_enviado_em: null,
      pixel_agendado_enviado_em: null,
    },
  ]);
  enviarEventoFacebookMock.mockClear();
  enviarEventoGoogleAdsMock.mockClear();
});

describe("dispararPixelSeConfigurado", () => {
  it("não dispara nada quando pixelAtivo está desligado", async () => {
    await dispararPixelSeConfigurado(criarAgenteConfig({ pixelAtivo: false }), "novo_lead", "clinica-1", "conversa-1", "556199990000");
    expect(enviarEventoFacebookMock).not.toHaveBeenCalled();
  });

  it("dispara pro Facebook quando Pixel ID e token estão configurados", async () => {
    await dispararPixelSeConfigurado(criarAgenteConfig(), "novo_lead", "clinica-1", "conversa-1", "556199990000");
    expect(enviarEventoFacebookMock).toHaveBeenCalledTimes(1);
  });

  it("não dispara pro Google quando faltam credenciais (fica só no Facebook)", async () => {
    await dispararPixelSeConfigurado(criarAgenteConfig(), "novo_lead", "clinica-1", "conversa-1", "556199990000");
    expect(enviarEventoGoogleAdsMock).not.toHaveBeenCalled();
  });

  it("dispara pros dois quando as duas plataformas estão configuradas", async () => {
    const agente = criarAgenteConfig({
      pixelGoogleCustomerId: "1234567890",
      pixelGoogleRefreshToken: "refresh-abc",
      pixelGoogleConversionActionNovoLead: "999",
    });
    await dispararPixelSeConfigurado(agente, "novo_lead", "clinica-1", "conversa-1", "556199990000");
    expect(enviarEventoFacebookMock).toHaveBeenCalledTimes(1);
    expect(enviarEventoGoogleAdsMock).toHaveBeenCalledTimes(1);
  });

  it("nunca dispara o mesmo evento 2x pra mesma conversa (dedup)", async () => {
    const agente = criarAgenteConfig();
    await dispararPixelSeConfigurado(agente, "novo_lead", "clinica-1", "conversa-1", "556199990000");
    await dispararPixelSeConfigurado(agente, "novo_lead", "clinica-1", "conversa-1", "556199990000");
    expect(enviarEventoFacebookMock).toHaveBeenCalledTimes(1);
  });

  it("eventos diferentes na mesma conversa disparam cada um a sua vez", async () => {
    const agente = criarAgenteConfig();
    await dispararPixelSeConfigurado(agente, "novo_lead", "clinica-1", "conversa-1", "556199990000");
    await dispararPixelSeConfigurado(agente, "agendado", "clinica-1", "conversa-1", "556199990000");
    expect(enviarEventoFacebookMock).toHaveBeenCalledTimes(2);
  });

  it("conversa de outra clínica (id bate, clinica_id não) não é afetada — dispara mesmo assim, sem vazar entre clínicas", async () => {
    await dispararPixelSeConfigurado(criarAgenteConfig(), "novo_lead", "clinica-inexistente", "conversa-1", "556199990000");
    expect(enviarEventoFacebookMock).not.toHaveBeenCalled();
  });
});

describe("extrairAtribuicaoWebhook", () => {
  it("sem mensagem nenhuma, devolve origemLead null", () => {
    expect(extrairAtribuicaoWebhook(null)).toEqual({ origemLead: null });
  });

  it("mensagem de texto simples sem contextInfo, devolve origemLead null", () => {
    expect(extrairAtribuicaoWebhook({ conversation: "Oi, quero agendar" })).toEqual({ origemLead: null });
  });

  it("acha sourceUrl dentro de extendedTextMessage.contextInfo.externalAdReplyInfo", () => {
    const message = {
      extendedTextMessage: {
        text: "Vim pelo anúncio",
        contextInfo: { externalAdReplyInfo: { sourceUrl: "https://fb.me/ad123", title: "Anúncio Implantes" } },
      },
    };
    expect(extrairAtribuicaoWebhook(message)).toEqual({ origemLead: "https://fb.me/ad123" });
  });

  it("sem sourceUrl, cai pro sourceId ou title do externalAdReplyInfo", () => {
    const message = { imageMessage: { contextInfo: { externalAdReplyInfo: { sourceId: "ad-999" } } } };
    expect(extrairAtribuicaoWebhook(message)).toEqual({ origemLead: "ad-999" });
  });
});
