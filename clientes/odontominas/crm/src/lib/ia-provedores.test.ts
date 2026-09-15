import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buscarModelo, CATALOGO_MODELOS, modelosDisponiveis } from "@/lib/ia-provedores";

const ENV_VARS = ["GOOGLE_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DEEPSEEK_API_KEY"];
const ORIGINAL: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_VARS) {
    ORIGINAL[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_VARS) {
    if (ORIGINAL[key] === undefined) delete process.env[key];
    else process.env[key] = ORIGINAL[key];
  }
});

describe("modelosDisponiveis", () => {
  it("sem nenhuma env var setada, não lista nenhum modelo", () => {
    expect(modelosDisponiveis()).toEqual([]);
  });

  it("só lista o modelo cuja env var de chave está setada", () => {
    process.env.GOOGLE_API_KEY = "chave-teste";
    const disponiveis = modelosDisponiveis();
    expect(disponiveis).toHaveLength(1);
    expect(disponiveis[0].provider).toBe("google");
  });

  it("com várias chaves setadas, lista um modelo por provedor configurado", () => {
    process.env.GOOGLE_API_KEY = "a";
    process.env.OPENAI_API_KEY = "b";
    const disponiveis = modelosDisponiveis();
    expect(disponiveis.map((m) => m.provider).sort()).toEqual(["google", "openai"]);
  });

  it("cobre todo o catálogo quando todas as chaves estão setadas", () => {
    for (const key of ENV_VARS) process.env[key] = "chave";
    expect(modelosDisponiveis()).toHaveLength(CATALOGO_MODELOS.length);
  });
});

describe("buscarModelo", () => {
  it("acha um modelo existente por provider+id", () => {
    const modelo = CATALOGO_MODELOS[0];
    expect(buscarModelo(modelo.provider, modelo.id)).toEqual(modelo);
  });

  it("devolve null pra provider/id que não existe no catálogo", () => {
    expect(buscarModelo("openai", "modelo-inexistente")).toBeNull();
    expect(buscarModelo("provedor-inexistente", "x")).toBeNull();
  });
});
