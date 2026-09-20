import { describe, expect, it } from "vitest";
import { isPermissaoDePlataforma, PERFIS_PADRAO, podeAtribuirPerfil, resolverPermissoes, validarConcessaoPermissoes } from "@/lib/permissoes";

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

describe("Indicadores - acesso por perfil", () => {
  it("Dona, Gerente, Supervisora e Noryos Admin veem; Atendente e Noryos Suporte nao veem por padrao", () => {
    for (const perfil of ["dona", "gerente", "supervisora", "noryos_admin"] as const) {
      expect(PERFIS_PADRAO[perfil].has("relatorios.visualizar")).toBe(true);
    }
    for (const perfil of ["atendente", "noryos_suporte"] as const) {
      expect(PERFIS_PADRAO[perfil].has("relatorios.visualizar")).toBe(false);
    }
  });
});

describe("Noryos Ops — permissões de plataforma", () => {
  it("Noryos Admin tem acesso completo ao Ops por padrão", () => {
    for (const p of ["ops.visualizar", "ops.clinicas", "ops.canais", "ops.integracoes", "ops.workers", "ops.erros", "ops.incidentes", "ops.auditoria"] as const) {
      expect(PERFIS_PADRAO.noryos_admin.has(p)).toBe(true);
    }
  });

  it("Noryos Suporte autorizado enxerga o Ops; perfis da clínica não", () => {
    expect(PERFIS_PADRAO.noryos_suporte.has("ops.visualizar")).toBe(true);
    for (const perfil of ["dona", "gerente", "supervisora", "atendente"] as const) {
      expect(PERFIS_PADRAO[perfil].has("ops.visualizar")).toBe(false);
      expect(PERFIS_PADRAO[perfil].has("ops.incidentes")).toBe(false);
    }
  });

  it("permissões ops.* são de plataforma e não podem ser concedidas a perfil de clínica", () => {
    expect(isPermissaoDePlataforma("ops.visualizar")).toBe(true);
    expect(validarConcessaoPermissoes("noryos_admin", PERFIS_PADRAO.noryos_admin, "gerente", ["ops.visualizar"])).toEqual({
      ok: false,
      error: "permissao_de_plataforma_em_perfil_de_clinica",
    });
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

describe("canais e caixa compartilhada — permissões padrão por perfil", () => {
  it("só a Dona configura, conecta e desconecta canais", () => {
    for (const p of ["canais.configurar", "canais.conectar", "canais.desconectar"] as const) {
      expect(PERFIS_PADRAO.dona.has(p)).toBe(true);
      for (const outro of ["gerente", "supervisora", "atendente", "noryos_suporte"] as const) expect(PERFIS_PADRAO[outro].has(p)).toBe(false);
    }
  });

  it("Gerente e Supervisora enxergam os canais; Atendente não tem tela de canais", () => {
    expect(PERFIS_PADRAO.gerente.has("canais.visualizar")).toBe(true);
    expect(PERFIS_PADRAO.supervisora.has("canais.visualizar")).toBe(true);
    expect(PERFIS_PADRAO.atendente.has("canais.visualizar")).toBe(false);
  });

  it("Noryos Suporte diagnostica canal, mas não responde paciente", () => {
    const suporte = PERFIS_PADRAO.noryos_suporte;
    expect(suporte.has("canais.visualizar")).toBe(true);
    expect(suporte.has("suporte.acesso_tecnico")).toBe(true);
    for (const p of ["conversas.assumir", "conversas.intervir", "conversas.transferir"] as const) expect(suporte.has(p)).toBe(false);
  });

  it("Atendente assume e transfere, mas só supervisão/gerência intervém em conversa de outra pessoa", () => {
    expect(PERFIS_PADRAO.atendente.has("conversas.assumir")).toBe(true);
    expect(PERFIS_PADRAO.atendente.has("conversas.intervir")).toBe(false);
    for (const p of ["gerente", "supervisora"] as const) expect(PERFIS_PADRAO[p].has("conversas.intervir")).toBe(true);
  });
});

describe("alertas.tecnicos é permissão de PLATAFORMA (decisão 2026-09-18)", () => {
  it("por padrão só Noryos Admin e Noryos Suporte; nenhum perfil da clínica", () => {
    expect(PERFIS_PADRAO.noryos_admin.has("alertas.tecnicos")).toBe(true);
    expect(PERFIS_PADRAO.noryos_suporte.has("alertas.tecnicos")).toBe(true);
    for (const p of ["dona", "gerente", "supervisora", "atendente"] as const) expect(PERFIS_PADRAO[p].has("alertas.tecnicos")).toBe(false);
  });

  it("é classificada como de plataforma: nem a Dona nem o Admin concedem a perfil de clínica", () => {
    expect(isPermissaoDePlataforma("alertas.tecnicos")).toBe(true);
    const r = validarConcessaoPermissoes("dona", PERFIS_PADRAO.dona, "gerente", ["alertas.visualizar", "alertas.tecnicos"]);
    expect(r.ok).toBe(false);
    const admin = validarConcessaoPermissoes("noryos_admin", PERFIS_PADRAO.noryos_admin, "gerente", ["alertas.tecnicos"]);
    expect(admin).toEqual({ ok: false, error: "permissao_de_plataforma_em_perfil_de_clinica" });
  });

  it("mesmo gravada direto no banco, não vale em perfil de clínica (defesa em profundidade); em plataforma vale", () => {
    expect(resolverPermissoes("gerente", ["alertas.visualizar", "alertas.tecnicos"]).has("alertas.tecnicos")).toBe(false);
    expect(resolverPermissoes("gerente", ["alertas.visualizar", "alertas.tecnicos"]).has("alertas.visualizar")).toBe(true);
    expect(resolverPermissoes("noryos_suporte", ["alertas.tecnicos"]).has("alertas.tecnicos")).toBe(true);
  });
});
