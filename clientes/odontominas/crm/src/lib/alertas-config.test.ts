import { describe, expect, it } from "vitest";
import { limiteInicialDaEtapa, validarConfig } from "@/lib/alertas-config";
import { limparTermoBusca, inicioDoDiaBrasilia, montarFiltroVisibilidade, ordenarPorPrioridade } from "@/lib/alertas-consulta";
import { PERFIS_PADRAO, type Perfil } from "@/lib/permissoes";

describe("configuração", () => {
  it("regras iniciais por nome de etapa: Novo 30 min, Follow-up 3 dias, resto sem regra", () => {
    expect(limiteInicialDaEtapa("Novo")).toBe(30);
    expect(limiteInicialDaEtapa("Follow-up")).toBe(4320);
    expect(limiteInicialDaEtapa("follow up")).toBe(4320);
    expect(limiteInicialDaEtapa("Agendado")).toBeNull();
  });

  it("valida limites e tipos", () => {
    expect(validarConfig({ semResponsavelMinutos: 10, canalCarenciaMinutos: 2, tiposDesabilitados: ["canal_desconectado"] })).toMatchObject({ ok: true, semResponsavel: 10, carencia: 2 });
    expect(validarConfig({ semResponsavelMinutos: 0 })).toEqual({ ok: false, error: "sem_responsavel_invalido" });
    expect(validarConfig({ semResponsavelMinutos: 1.5 })).toEqual({ ok: false, error: "sem_responsavel_invalido" });
    expect(validarConfig({ canalCarenciaMinutos: -1 })).toEqual({ ok: false, error: "carencia_invalida" });
    expect(validarConfig({ tiposDesabilitados: ["inventado"] })).toEqual({ ok: false, error: "tipos_invalidos" });
    expect(validarConfig({ kanbanRegras: [{ estagioId: "e1", limiteMinutos: 0 }] })).toEqual({ ok: false, error: "kanban_invalido" });
    expect(validarConfig({ kanbanRegras: [{ estagioId: "e1", limiteMinutos: null }] })).toMatchObject({ ok: true, regras: [{ estagioId: "e1", limiteMinutos: null }] });
  });

  it("campo ausente não é alterado (PUT parcial)", () => {
    expect(validarConfig({})).toEqual({ ok: true });
  });
});

describe("consulta", () => {
  function ator(perfil: Perfil, id = "u-1") {
    return { atendenteId: id, permissoes: PERFIS_PADRAO[perfil] };
  }

  it("visão de equipe: filtro por tipo, sem restrição de responsável", () => {
    const f = montarFiltroVisibilidade(ator("gerente"));
    expect(f.expressaoOr).toBeNull();
    expect(f.tipos).toContain("canal_desconectado");
  });

  it("atendente: só próprios + fila nos tipos por responsável; nunca canal", () => {
    const f = montarFiltroVisibilidade(ator("atendente", "abc"));
    expect(f.expressaoOr).toContain("responsavel_id.eq.abc");
    expect(f.expressaoOr).toContain("responsavel_id.is.null");
    expect(f.tipos).not.toContain("canal_desconectado");
  });

  it("sem permissão nenhuma: nada", () => {
    expect(montarFiltroVisibilidade({ atendenteId: "x", permissoes: new Set() }).tipos).toEqual([]);
  });

  it("ordenação: críticos primeiro; dentro da severidade, os mais antigos primeiro", () => {
    const itens = [
      { id: "a", severidade: "atencao" as const, detectadoEm: "2026-09-18T10:00:00Z" },
      { id: "b", severidade: "critico" as const, detectadoEm: "2026-09-18T12:00:00Z" },
      { id: "c", severidade: "critico" as const, detectadoEm: "2026-09-18T11:00:00Z" },
      { id: "d", severidade: "informativo" as const, detectadoEm: "2026-09-18T09:00:00Z" },
    ];
    expect(ordenarPorPrioridade(itens).map((i) => i.id)).toEqual(["c", "b", "a", "d"]);
  });

  it("busca: remove o que quebraria o filtro do PostgREST", () => {
    expect(limparTermoBusca("Maria, (Silva)%")).toBe("Maria Silva");
    expect(limparTermoBusca("[TESTE UI]")).toBe("TESTE UI");
    expect(limparTermoBusca("   ")).toBe("");
  });

  it("'hoje' no fuso de Brasília (UTC-3): 01:00Z de 19/09 ainda é 18/09 local", () => {
    expect(inicioDoDiaBrasilia(new Date("2026-09-19T01:00:00Z")).toISOString()).toBe("2026-09-18T03:00:00.000Z");
    expect(inicioDoDiaBrasilia(new Date("2026-09-18T15:00:00Z")).toISOString()).toBe("2026-09-18T03:00:00.000Z");
  });
});
