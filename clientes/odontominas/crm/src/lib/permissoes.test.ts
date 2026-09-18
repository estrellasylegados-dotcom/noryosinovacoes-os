import { describe, expect, it } from "vitest";
import { PERFIS_PADRAO, podeAtribuirPerfil, resolverPermissoes } from "@/lib/permissoes";

describe("resolverPermissoes", () => {
  it("sem customização, usa o default do perfil", () => {
    expect(resolverPermissoes("atendente", null)).toEqual(PERFIS_PADRAO.atendente);
  });

  it("customização explícita substitui o default, mesmo sendo mais restritiva", () => {
    const custom = resolverPermissoes("dona", ["pacientes.visualizar"]);
    expect(custom.has("pacientes.visualizar")).toBe(true);
    expect(custom.has("usuarios.criar")).toBe(false);
  });

  it("lista vazia zera as permissões (não cai de volta no default — distingue null de [])", () => {
    const custom = resolverPermissoes("dona", []);
    expect(custom.size).toBe(0);
  });

  it("ignora ids de permissão inválidos numa customização", () => {
    const custom = resolverPermissoes("atendente", ["pacientes.visualizar", "algo_que_nao_existe"]);
    expect(custom.has("pacientes.visualizar")).toBe(true);
    expect(custom.has("algo_que_nao_existe" as never)).toBe(false);
    expect(custom.size).toBe(1);
  });
});

describe("perfis padrão — regras de escopo (seções 6-11 do pedido)", () => {
  it("Dona nunca tem permissão de plataforma ou suporte", () => {
    const dona = PERFIS_PADRAO.dona;
    expect(dona.has("platform.ops")).toBe(false);
    expect(dona.has("suporte.acesso_tecnico")).toBe(false);
  });

  it("Noryos Suporte não tem poderes de gestão de usuário da Dona por padrão", () => {
    const suporte = PERFIS_PADRAO.noryos_suporte;
    expect(suporte.has("usuarios.criar")).toBe(false);
    expect(suporte.has("usuarios.editar")).toBe(false);
    expect(suporte.has("usuarios.gerenciar_permissoes")).toBe(false);
  });

  it("Gerente e Supervisora não gerenciam permissões nem configuração técnica", () => {
    for (const perfil of ["gerente", "supervisora"] as const) {
      const permissoes = PERFIS_PADRAO[perfil];
      expect(permissoes.has("usuarios.gerenciar_permissoes")).toBe(false);
      expect(permissoes.has("configuracoes.integracoes")).toBe(false);
      expect(permissoes.has("automacoes.criar")).toBe(false);
    }
  });

  it("Atendente não vê configurações, equipe nem automações", () => {
    const atendente = PERFIS_PADRAO.atendente;
    expect(atendente.has("usuarios.visualizar")).toBe(false);
    expect(atendente.has("configuracoes.clinica")).toBe(false);
    expect(atendente.has("automacoes.visualizar")).toBe(false);
  });
});

describe("podeAtribuirPerfil — regra de elevação (seção 40/41 do pedido)", () => {
  it("Dona pode criar Gerente, Supervisora e Atendente", () => {
    expect(podeAtribuirPerfil("dona", "gerente")).toBe(true);
    expect(podeAtribuirPerfil("dona", "supervisora")).toBe(true);
    expect(podeAtribuirPerfil("dona", "atendente")).toBe(true);
  });

  it("Dona não pode criar Dona nem Noryos Admin/Suporte", () => {
    expect(podeAtribuirPerfil("dona", "dona")).toBe(false);
    expect(podeAtribuirPerfil("dona", "noryos_admin")).toBe(false);
    expect(podeAtribuirPerfil("dona", "noryos_suporte")).toBe(false);
  });

  it("Gerente, Supervisora e Atendente não atribuem nenhum perfil", () => {
    for (const perfil of ["gerente", "supervisora", "atendente"] as const) {
      expect(podeAtribuirPerfil(perfil, "atendente")).toBe(false);
    }
  });

  it("Noryos Suporte não vira Dona por atribuição comum", () => {
    expect(podeAtribuirPerfil("noryos_suporte", "dona")).toBe(false);
  });

  it("Noryos Admin pode atribuir qualquer perfil, inclusive de plataforma", () => {
    expect(podeAtribuirPerfil("noryos_admin", "dona")).toBe(true);
    expect(podeAtribuirPerfil("noryos_admin", "noryos_admin")).toBe(true);
    expect(podeAtribuirPerfil("noryos_admin", "noryos_suporte")).toBe(true);
  });
});

describe("podeRedefinirCredencial", () => {
  it("Suporte redefine perfis operacionais, nunca a Dona nem plataforma", async () => {
    const { podeRedefinirCredencial } = await import("@/lib/permissoes");
    for (const alvo of ["gerente", "supervisora", "atendente"] as const) expect(podeRedefinirCredencial("noryos_suporte", alvo)).toBe(true);
    for (const alvo of ["dona", "noryos_admin", "noryos_suporte"] as const) expect(podeRedefinirCredencial("noryos_suporte", alvo)).toBe(false);
  });
  it("Dona não redefine outra Dona nem plataforma; Noryos Admin redefine todos; operacionais nenhum", async () => {
    const { podeRedefinirCredencial } = await import("@/lib/permissoes");
    expect(podeRedefinirCredencial("dona", "gerente")).toBe(true);
    expect(podeRedefinirCredencial("dona", "dona")).toBe(false);
    expect(podeRedefinirCredencial("dona", "noryos_admin")).toBe(false);
    expect(podeRedefinirCredencial("noryos_admin", "dona")).toBe(true);
    for (const ator of ["gerente", "supervisora", "atendente"] as const) expect(podeRedefinirCredencial(ator, "atendente")).toBe(false);
  });
});

describe("validarConcessaoPermissoes", () => {
  it("Dona concede a perfil operacional só o que ela mesma tem", async () => {
    const { validarConcessaoPermissoes, PERFIS_PADRAO } = await import("@/lib/permissoes");
    const dona = PERFIS_PADRAO.dona;
    expect(validarConcessaoPermissoes("dona", dona, "gerente", ["sla.configurar", "conversas.assumir"])).toEqual({ ok: true });
    expect(validarConcessaoPermissoes("dona", dona, "atendente", null)).toEqual({ ok: true });
  });
  it("Dona não concede permissão de plataforma nem mexe em Dona/plataforma", async () => {
    const { validarConcessaoPermissoes, PERFIS_PADRAO } = await import("@/lib/permissoes");
    const dona = PERFIS_PADRAO.dona;
    expect(validarConcessaoPermissoes("dona", dona, "gerente", ["platform.ops"])).toEqual({ ok: false, error: "permissao_acima_do_escopo" });
    expect(validarConcessaoPermissoes("dona", dona, "gerente", ["suporte.acesso_tecnico"])).toEqual({ ok: false, error: "permissao_acima_do_escopo" });
    expect(validarConcessaoPermissoes("dona", dona, "dona", ["sla.configurar"])).toEqual({ ok: false, error: "perfil_nao_permitido" });
    expect(validarConcessaoPermissoes("dona", dona, "noryos_admin", null)).toEqual({ ok: false, error: "perfil_nao_permitido" });
  });
  it("Gerente, Supervisora, Atendente e Suporte nunca concedem", async () => {
    const { validarConcessaoPermissoes, PERFIS_PADRAO } = await import("@/lib/permissoes");
    for (const ator of ["gerente", "supervisora", "atendente", "noryos_suporte"] as const) {
      expect(validarConcessaoPermissoes(ator, PERFIS_PADRAO[ator], "atendente", ["conversas.assumir"]).ok).toBe(false);
      expect(validarConcessaoPermissoes(ator, PERFIS_PADRAO[ator], "gerente", null).ok).toBe(false);
    }
  });
  it("Noryos Admin não põe permissão de plataforma em perfil de clínica, mas pode em plataforma", async () => {
    const { validarConcessaoPermissoes, PERFIS_PADRAO } = await import("@/lib/permissoes");
    const na = PERFIS_PADRAO.noryos_admin;
    expect(validarConcessaoPermissoes("noryos_admin", na, "gerente", ["platform.ops"])).toEqual({ ok: false, error: "permissao_de_plataforma_em_perfil_de_clinica" });
    expect(validarConcessaoPermissoes("noryos_admin", na, "noryos_suporte", ["suporte.visualizar_logs"])).toEqual({ ok: true });
    expect(validarConcessaoPermissoes("noryos_admin", na, "dona", ["sla.configurar"])).toEqual({ ok: true });
  });
});
