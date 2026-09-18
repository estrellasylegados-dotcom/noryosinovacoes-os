import { describe, expect, it } from "vitest";
import { normalizarUsuario, validarDadosNovoAtendente } from "@/lib/atendentes";

describe("normalizarUsuario", () => {
  it("tira espaço nas pontas e vira minúsculo (mesma regra do login)", () => {
    expect(normalizarUsuario("  Recepcao1  ")).toBe("recepcao1");
  });
});

describe("validarDadosNovoAtendente", () => {
  const validos = { nome: "Recepção 1", usuario: "recepcao1", senha: "senha-forte-123", papel: "atendente" };

  it("aceita dados válidos", () => {
    expect(validarDadosNovoAtendente(validos)).toBeNull();
  });

  it("exige nome", () => {
    expect(validarDadosNovoAtendente({ ...validos, nome: "  " })).toBe("nome_obrigatorio");
  });

  it("exige usuário", () => {
    expect(validarDadosNovoAtendente({ ...validos, usuario: "  " })).toBe("usuario_obrigatorio");
  });

  it("rejeita usuário com caractere fora de letra/número/./-/_", () => {
    expect(validarDadosNovoAtendente({ ...validos, usuario: "recepção 1" })).toBe("usuario_invalido");
  });

  it("aceita usuário com ponto, hífen e underline", () => {
    expect(validarDadosNovoAtendente({ ...validos, usuario: "ana.paula-2_silva" })).toBeNull();
  });

  it("rejeita senha curta", () => {
    expect(validarDadosNovoAtendente({ ...validos, senha: "1234567" })).toBe("senha_muito_curta");
  });

  it("aceita senha com exatamente 8 caracteres", () => {
    expect(validarDadosNovoAtendente({ ...validos, senha: "12345678" })).toBeNull();
  });

  it("rejeita papel desconhecido", () => {
    expect(validarDadosNovoAtendente({ ...validos, papel: "gerente" })).toBe("papel_invalido");
  });

  it("valida na ordem nome -> usuário -> senha -> papel", () => {
    expect(validarDadosNovoAtendente({ nome: "", usuario: "", senha: "", papel: "" })).toBe("nome_obrigatorio");
  });
});
