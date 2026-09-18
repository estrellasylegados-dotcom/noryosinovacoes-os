import { describe, expect, it } from "vitest";
import { normalizarEmail, normalizarUsuario, validarDadosConvite } from "@/lib/atendentes";

describe("normalizarUsuario", () => {
  it("tira espaço nas pontas e vira minúsculo (mesma regra do login)", () => {
    expect(normalizarUsuario("  Recepcao1  ")).toBe("recepcao1");
  });
});

describe("normalizarEmail", () => {
  it("tira espaço nas pontas e vira minúsculo", () => {
    expect(normalizarEmail("  Ana.Silva@Exemplo.COM  ")).toBe("ana.silva@exemplo.com");
  });
});

describe("validarDadosConvite", () => {
  const validos = { nome: "Ana Silva", email: "ana@exemplo.com", perfil: "atendente" };

  it("aceita dados válidos", () => {
    expect(validarDadosConvite(validos)).toBeNull();
  });

  it("exige nome", () => {
    expect(validarDadosConvite({ ...validos, nome: "  " })).toBe("nome_obrigatorio");
  });

  it("rejeita e-mail sem @", () => {
    expect(validarDadosConvite({ ...validos, email: "ana-exemplo.com" })).toBe("email_invalido");
  });

  it("rejeita e-mail sem domínio", () => {
    expect(validarDadosConvite({ ...validos, email: "ana@" })).toBe("email_invalido");
  });

  it("aceita qualquer um dos 6 perfis", () => {
    for (const perfil of ["noryos_admin", "noryos_suporte", "dona", "gerente", "supervisora", "atendente"]) {
      expect(validarDadosConvite({ ...validos, perfil })).toBeNull();
    }
  });

  it("rejeita perfil desconhecido", () => {
    expect(validarDadosConvite({ ...validos, perfil: "gerente-geral" })).toBe("perfil_invalido");
  });

  it("valida na ordem nome -> email -> perfil", () => {
    expect(validarDadosConvite({ nome: "", email: "", perfil: "" })).toBe("nome_obrigatorio");
  });
});
