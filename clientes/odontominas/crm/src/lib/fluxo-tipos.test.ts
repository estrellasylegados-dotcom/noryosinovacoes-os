import { describe, expect, it } from "vitest";
import { validarFormaDefinicao } from "@/lib/fluxo-tipos";

function bruto(nodes: unknown[]) {
  return { nodes, edges: [], config: {} };
}

describe("validarFormaDefinicao — capturar_resposta (Fase 3)", () => {
  const valido = {
    id: "cap",
    tipo: "capturar_resposta",
    texto: "De 0 a 10?",
    variavel: "nps_nota",
    tipoValor: "numero",
    min: 0,
    max: 10,
    proximo: "fim",
  };

  it("aceita configuração mínima válida", () => {
    const resultado = validarFormaDefinicao(bruto([valido]));
    expect(resultado.ok).toBe(true);
  });

  it("aceita min=0 (diferente de campos numéricos positivos do resto do fluxo)", () => {
    const resultado = validarFormaDefinicao(bruto([{ ...valido, min: 0, max: 10 }]));
    expect(resultado.ok).toBe(true);
  });

  it("recusa sem texto", () => {
    const { texto, ...semTexto } = valido;
    void texto;
    const resultado = validarFormaDefinicao(bruto([semTexto]));
    expect(resultado.ok).toBe(false);
  });

  it("recusa sem variavel", () => {
    const { variavel, ...semVariavel } = valido;
    void variavel;
    const resultado = validarFormaDefinicao(bruto([semVariavel]));
    expect(resultado.ok).toBe(false);
  });

  it("recusa tipoValor desconhecido", () => {
    const resultado = validarFormaDefinicao(bruto([{ ...valido, tipoValor: "data" }]));
    expect(resultado.ok).toBe(false);
  });

  it("recusa sem proximo", () => {
    const { proximo, ...semProximo } = valido;
    void proximo;
    const resultado = validarFormaDefinicao(bruto([semProximo]));
    expect(resultado.ok).toBe(false);
  });

  it("aceita tipoValor texto sem min/max/regex (todos opcionais)", () => {
    const resultado = validarFormaDefinicao(bruto([{ id: "cap", tipo: "capturar_resposta", texto: "Motivo?", variavel: "motivo", tipoValor: "texto", proximo: "fim" }]));
    expect(resultado.ok).toBe(true);
  });
});

describe("validarFormaDefinicao — criar_pesquisa (Fase 3)", () => {
  it("aceita os 3 tipos de pesquisa", () => {
    for (const tipoPesquisa of ["nps", "satisfacao", "avaliacao_google"]) {
      const resultado = validarFormaDefinicao(
        bruto([{ id: "c", tipo: "criar_pesquisa", tipoPesquisa, variavelDestino: "pesquisa_id", proximo: "fim" }])
      );
      expect(resultado.ok).toBe(true);
    }
  });

  it("recusa tipoPesquisa desconhecido", () => {
    const resultado = validarFormaDefinicao(
      bruto([{ id: "c", tipo: "criar_pesquisa", tipoPesquisa: "csat_legado", variavelDestino: "pesquisa_id", proximo: "fim" }])
    );
    expect(resultado.ok).toBe(false);
  });

  it("recusa sem variavelDestino", () => {
    const resultado = validarFormaDefinicao(bruto([{ id: "c", tipo: "criar_pesquisa", tipoPesquisa: "nps", proximo: "fim" }]));
    expect(resultado.ok).toBe(false);
  });

  it("referenciaId é opcional", () => {
    const resultado = validarFormaDefinicao(
      bruto([{ id: "c", tipo: "criar_pesquisa", tipoPesquisa: "nps", variavelDestino: "pesquisa_id", proximo: "fim" }])
    );
    expect(resultado.ok).toBe(true);
  });
});

describe("validarFormaDefinicao — persistir_resposta_pesquisa (Fase 3)", () => {
  it("aceita configuração mínima válida", () => {
    const resultado = validarFormaDefinicao(
      bruto([{ id: "p", tipo: "persistir_resposta_pesquisa", variavelPesquisaId: "pesquisa_id", variavelValor: "nps_nota", proximo: "fim" }])
    );
    expect(resultado.ok).toBe(true);
  });

  it("recusa sem variavelPesquisaId", () => {
    const resultado = validarFormaDefinicao(
      bruto([{ id: "p", tipo: "persistir_resposta_pesquisa", variavelValor: "nps_nota", proximo: "fim" }])
    );
    expect(resultado.ok).toBe(false);
  });

  it("recusa sem variavelValor", () => {
    const resultado = validarFormaDefinicao(
      bruto([{ id: "p", tipo: "persistir_resposta_pesquisa", variavelPesquisaId: "pesquisa_id", proximo: "fim" }])
    );
    expect(resultado.ok).toBe(false);
  });

  it("variavelComentario é opcional", () => {
    const resultado = validarFormaDefinicao(
      bruto([
        {
          id: "p",
          tipo: "persistir_resposta_pesquisa",
          variavelPesquisaId: "pesquisa_id",
          variavelValor: "nps_nota",
          variavelComentario: "nps_comentario",
          proximo: "fim",
        },
      ])
    );
    expect(resultado.ok).toBe(true);
  });
});
