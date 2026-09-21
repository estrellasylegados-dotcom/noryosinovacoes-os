import { describe, expect, it } from "vitest";
import { estadoPorProblemas, mensagemSegura, podeAcessarOps } from "@/lib/noryos-ops";
import { PERFIS_PADRAO, resolverPermissoes, type Perfil } from "@/lib/permissoes";
import type { SessaoAtual } from "@/lib/sessao-servidor";

function sessao(perfil: Perfil): SessaoAtual {
  return {
    atendenteId: `at-${perfil}`,
    nome: perfil,
    usuario: perfil,
    email: null,
    perfil,
    clinicaId: perfil.startsWith("noryos_") ? null : "clinica-1",
    permissoes: resolverPermissoes(perfil, null),
  };
}

describe("podeAcessarOps", () => {
  it("permite Noryos Admin e Noryos Suporte com permissão", () => {
    expect(podeAcessarOps(sessao("noryos_admin"))).toBe(true);
    expect(podeAcessarOps(sessao("noryos_suporte"))).toBe(true);
  });

  it("bloqueia perfis da clínica mesmo se a tela fosse chamada diretamente", () => {
    for (const perfil of ["dona", "gerente", "supervisora", "atendente"] as const) {
      expect(podeAcessarOps(sessao(perfil))).toBe(false);
    }
  });

  it("bloqueia suporte sem autorização customizada", () => {
    const suporteSemOps = { ...sessao("noryos_suporte"), permissoes: new Set([...PERFIS_PADRAO.noryos_suporte].filter((p) => !p.startsWith("ops."))) };
    expect(podeAcessarOps(suporteSemOps)).toBe(false);
  });
});

describe("saúde e segurança do Ops", () => {
  it("classifica crítico antes de atenção", () => {
    expect(estadoPorProblemas({ criticos: 1, atencao: 10 })).toBe("critico");
    expect(estadoPorProblemas({ atencao: 1 })).toBe("atencao");
    expect(estadoPorProblemas({})).toBe("saudavel");
  });

  it("redige segredos de mensagens técnicas", () => {
    expect(mensagemSegura("falha token=abc123456789 password=minhasenha Bearer eyJhbGciOiJIUzI1NiJ9.xxxxxxxxxxxxxxxxxxxxxx")).not.toContain("abc123456789");
  });
});
