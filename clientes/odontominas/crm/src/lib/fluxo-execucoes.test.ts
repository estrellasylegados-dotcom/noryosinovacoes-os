import { describe, expect, it, vi } from "vitest";

/**
 * EXCEÇÃO pontual ao critério do resto do arquivo (fluxo-execucoes.ts é
 * camada de I/O, "sem teste direto" por convenção deste projeto — mesmo
 * padrão de disparos-worker.ts/agentes.ts). Este único teste existe porque
 * um bug real (updated_at nunca mudava ao transferir pra humano) só seria
 * pego observando exatamente os campos que o UPDATE manda pro banco — não
 * generalizar esse padrão de mock pra outras funções deste arquivo.
 */

type Resultado = { data?: unknown; error?: unknown };

// Objeto mutável (não `let` solto) de propósito: TS estreita uma variável
// `let` só reatribuída dentro de uma closure assíncrona pro tipo do último
// valor visível no fluxo do teste (`undefined`) — acesso por propriedade
// escapa desse estreitamento indevido. Só grava quando a tabela é
// fluxo_execucoes — a mesma função sob teste também dispara um UPDATE em
// "conversas" (via liberarControle), que não pode sobrescrever o payload
// que este teste realmente quer inspecionar.
const capturado: { payloadFluxoExecucoes: Record<string, unknown> | undefined } = { payloadFluxoExecucoes: undefined };
// Getter (não acesso direto à propriedade) de propósito: quebra o
// estreitamento de fluxo do TS através do `await` — sem isso, o compilador
// assume que nada mudou `capturado.payloadFluxoExecucoes` entre a atribuição
// de reset e a leitura, mesmo a mudança real vindo de uma closure externa.
function payloadCapturado(): Record<string, unknown> | undefined {
  return capturado.payloadFluxoExecucoes;
}

function chain(resultado: Resultado, tabela: string) {
  const objeto: Record<string, unknown> = {
    select: () => objeto,
    update: (payload: Record<string, unknown>) => {
      if (tabela === "fluxo_execucoes") capturado.payloadFluxoExecucoes = payload;
      return objeto;
    },
    eq: () => objeto,
    in: () => objeto,
    maybeSingle: () => Promise.resolve(resultado),
    then: (resolve: (v: Resultado) => void) => Promise.resolve(resultado).then(resolve),
  };
  return objeto;
}

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => ({
    from: (tabela: string) => {
      if (tabela === "conversas") {
        // 1ª chamada (dentro de transferirExecucaoAtivaParaHumano): SELECT fluxo_execucao_ativa_id.
        // 2ª chamada (dentro de liberarControle→assumirControle): UPDATE dono_conversa.
        return chain({ data: { fluxo_execucao_ativa_id: "execucao-1" }, error: null }, tabela);
      }
      // fluxo_execucoes: o UPDATE que este teste realmente verifica.
      return chain({ data: null, error: null }, tabela);
    },
  }),
}));

import { transferirExecucaoAtivaParaHumano } from "@/lib/fluxo-execucoes";

describe("transferirExecucaoAtivaParaHumano — updated_at (achado da Fase 3)", () => {
  it("atualiza updated_at junto com estado/motivo_finalizacao/finalizado_em, nunca só o estado sozinho", async () => {
    capturado.payloadFluxoExecucoes = undefined;
    await transferirExecucaoAtivaParaHumano("clinica-1", "conversa-1", "resposta_manual_chat");

    const payload = payloadCapturado();
    expect(payload).toBeDefined();
    expect(payload).toMatchObject({ estado: "transferred", motivo_finalizacao: "resposta_manual_chat" });
    expect(payload?.updated_at).toBeDefined();
    expect(payload?.finalizado_em).toBe(payload?.updated_at);
  });
});
