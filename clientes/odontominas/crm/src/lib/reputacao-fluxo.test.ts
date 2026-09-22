import { describe, expect, it } from "vitest";
import { processarNo } from "@/lib/fluxo-motor";
import type { FluxoDefinicao } from "@/lib/fluxo-tipos";

const definicao: FluxoDefinicao = { nodes: [{ id: "classificar", tipo: "classificar_experiencia", variavelPesquisaId: "pesquisa", variavelResposta: "resposta", variavelClassificacao: "classificacao", proximoPositivo: "positivo", proximoNegativo: "negativo", proximoAmbiguo: "ambiguo" }], edges: [], config: {} };
const paciente = { nome: "Ana", telefone: "61999999999" };
const contadores = { visitas: 0, tentativasInvalidas: 0 };

describe("Fluxo de experiência", () => {
  it.each([
    ["Muito boa", "positivo", "muito_boa"],
    ["Foi boa, tudo certo", "positivo", "boa"],
    ["Demorou e não gostei", "negativo", "poderia_melhorar"],
    ["Foi mais ou menos", "ambiguo", "ambiguo"],
  ])("classifica %s de forma conservadora", (resposta, proximo, classificacao) => {
    const resultado = processarNo(definicao, "classificar", { pesquisa: "p1", resposta }, { tipo: "avancar" }, paciente, contadores);
    expect(resultado).toMatchObject({ ok: true, proximoNoId: proximo, variaveisAtualizadas: { classificacao } });
    expect(resultado.ok && resultado.acaoCrm).toMatchObject({ tipo: "registrar_experiencia", classificacao });
  });
});
