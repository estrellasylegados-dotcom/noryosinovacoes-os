import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarFakeDb, type FakeDb } from "@/lib/fake-supabase.testutil";
import type { Condicao } from "@/lib/alertas-tipos";
import type { DeteccaoAlertas } from "@/lib/alertas";

let db: FakeDb;
vi.mock("@/lib/supabase", () => ({ getSupabaseServerClient: () => db.client }));
vi.mock("@/lib/auditoria", () => ({ registrarEvento: vi.fn(async () => undefined) }));
vi.mock("@/lib/fluxo-lock", () => ({ adquirirLock: vi.fn(async () => ({ ok: true, holder: "h" })), liberarLock: vi.fn(async () => undefined) }));
vi.mock("@/lib/sla", () => ({ carregarContextoSla: vi.fn(async () => ({ config: {}, horario: null, horarioConfigurado: false })) }));

const config = { tiposDesabilitados: new Set<string>(), semResponsavelMinutos: 10, canalCarenciaMinutos: 2, regrasKanban: [] as unknown[] };
vi.mock("@/lib/alertas-config", () => ({ buscarConfigVerificador: vi.fn(async () => config), registrarVerificacao: vi.fn(async () => undefined) }));

const det = {
  conversas: vi.fn(),
  kanban: vi.fn(),
  canais: vi.fn(),
  fluxos: vi.fn(),
  disparos: vi.fn(),
};
vi.mock("@/lib/alertas-detectores", () => ({
  detectarConversas: (...a: unknown[]) => det.conversas(...a),
  detectarKanban: (...a: unknown[]) => det.kanban(...a),
  detectarCanais: (...a: unknown[]) => det.canais(...a),
  detectarFluxos: (...a: unknown[]) => det.fluxos(...a),
  detectarDisparos: (...a: unknown[]) => det.disparos(...a),
}));

import { verificarAlertas, verificarAlertasComLock } from "@/lib/alertas-verificador";
import { resolverPorEvento } from "@/lib/alertas";
import { adquirirLock } from "@/lib/fluxo-lock";

const CLINICA = "clinica-1";
const vazio = (tipos: DeteccaoAlertas["tipos"]): DeteccaoAlertas => ({ tipos, ativas: [] });

function slaCond(sev: "atencao" | "critico", extra: Partial<Condicao> = {}): Condicao {
  return { tipo: "sla_limite", chave: "sla:c1:m1", severidade: sev, titulo: sev === "critico" ? "SLA estourado" : "SLA próximo do limite", tipoEntidade: "conversa", entidadeId: "c1", responsavelId: "juliana", ...extra };
}

/** Cenário de conversas: o que o detector de conversas devolve nesta rodada. */
function cenarioConversas(sla: Condicao[], semResp: Condicao[] = [], manter: string[] = []) {
  det.conversas.mockResolvedValue({
    sla: { tipos: ["sla_limite"], ativas: sla, manter },
    semResponsavel: { tipos: ["conversa_sem_responsavel"], ativas: semResp },
    conversasComSla: new Set(sla.map((c) => c.entidadeId)),
  });
}

const alertas = () => db.tables.alertas ?? [];

beforeEach(() => {
  vi.clearAllMocks();
  db = criarFakeDb({ alertas: [["clinica_id", "chave_ativa"]] }, {}, { alertas: { status: "aberto", natureza: "operacional", dados: {}, detectado_em: "2026-09-18T12:00:00.000Z" } });
  config.tiposDesabilitados = new Set();
  config.regrasKanban = [];
  cenarioConversas([]);
  det.kanban.mockResolvedValue(vazio(["oportunidade_parada"]));
  det.canais.mockResolvedValue(vazio(["canal_desconectado"]));
  det.fluxos.mockResolvedValue({ falhou: vazio(["fluxo_falhou"]), preso: vazio(["fluxo_preso"]), indisponivel: vazio(["automacao_indisponivel"]) });
  det.disparos.mockResolvedValue(vazio(["disparo_falhas"]));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("SLA em atenção", () => {
  it("entra na faixa de atenção → 1 alerta; rodar de novo → continua 1", async () => {
    cenarioConversas([slaCond("atencao")]);
    const r1 = await verificarAlertas(CLINICA);
    expect(r1.totais.criados).toBe(1);
    await verificarAlertas(CLINICA);
    await verificarAlertas(CLINICA);
    expect(alertas()).toHaveLength(1);
    expect(alertas()[0]).toMatchObject({ severidade: "atencao", status: "aberto", categoria: "SLA", responsavel_id: "juliana" });
  });
});

describe("SLA estourado", () => {
  it("alerta em atenção existe, SLA estoura → o MESMO alerta vira crítico (não cria outro)", async () => {
    cenarioConversas([slaCond("atencao")]);
    await verificarAlertas(CLINICA);
    const id = alertas()[0].id;

    cenarioConversas([slaCond("critico")]);
    const r = await verificarAlertas(CLINICA);
    expect(r.totais).toMatchObject({ escalados: 1, criados: 0 });
    expect(alertas()).toHaveLength(1);
    expect(alertas()[0]).toMatchObject({ id, severidade: "critico", titulo: "SLA estourado" });
    expect((db.tables.alerta_historico ?? []).map((h) => h.evento)).toEqual(["criado", "severidade_alterada"]);
  });
});

describe("resolução automática do SLA", () => {
  it("humano responde (ciclo fecha) → alerta resolvido, com o evento que resolveu", async () => {
    cenarioConversas([slaCond("critico")]);
    await verificarAlertas(CLINICA);

    cenarioConversas([]);
    const r = await verificarAlertas(CLINICA);
    expect(r.totais.resolvidos).toBe(1);
    expect(alertas()[0]).toMatchObject({ status: "resolvido", chave_ativa: null, resolvido_por_evento: "condicao_encerrada" });
    expect(alertas()[0].resolvido_em).toBeTruthy();
  });

  it("por evento, na hora: resposta humana resolve sem esperar o verificador — e o verificador seguinte não recria", async () => {
    cenarioConversas([slaCond("critico")]);
    await verificarAlertas(CLINICA);
    await resolverPorEvento(CLINICA, { tipos: ["sla_limite"], tipoEntidade: "conversa", entidadeId: "c1", evento: "resposta_humana", atorId: "juliana" });
    expect(alertas()[0]).toMatchObject({ status: "resolvido", resolvido_por_evento: "resposta_humana", resolvido_por: "juliana" });

    cenarioConversas([]); // ciclo fechado no banco: nada a detectar
    await verificarAlertas(CLINICA);
    expect(alertas()).toHaveLength(1);
  });

  it("SLA pausado fora do expediente: alerta existente NÃO é resolvido (nem recriado ao voltar)", async () => {
    cenarioConversas([slaCond("atencao")]);
    await verificarAlertas(CLINICA);
    cenarioConversas([], [], ["sla:c1:m1"]);
    await verificarAlertas(CLINICA);
    expect(alertas()).toHaveLength(1);
    expect(alertas()[0].status).toBe("aberto");
  });
});

describe("conversa sem responsável", () => {
  const semResp: Condicao = { tipo: "conversa_sem_responsavel", chave: "sem_resp:c1:m1", severidade: "atencao", titulo: "Conversa sem responsável", tipoEntidade: "conversa", entidadeId: "c1", responsavelId: null };

  it("passou do tempo → alerta da equipe (sem responsável); atendente assume → resolvido", async () => {
    cenarioConversas([], [semResp]);
    await verificarAlertas(CLINICA);
    expect(alertas()[0]).toMatchObject({ tipo: "conversa_sem_responsavel", responsavel_id: null, categoria: "CONVERSA" });

    cenarioConversas([], []);
    await verificarAlertas(CLINICA);
    expect(alertas()[0]).toMatchObject({ status: "resolvido", chave_ativa: null });
  });

  it("evento 'conversa assumida' resolve na hora", async () => {
    cenarioConversas([], [semResp]);
    await verificarAlertas(CLINICA);
    await resolverPorEvento(CLINICA, { tipos: ["conversa_sem_responsavel"], tipoEntidade: "conversa", entidadeId: "c1", evento: "conversa_assumida", atorId: "juliana" });
    expect(alertas()[0]).toMatchObject({ status: "resolvido", resolvido_por_evento: "conversa_assumida" });
  });
});

describe("oportunidade parada", () => {
  const parada: Condicao = { tipo: "oportunidade_parada", chave: "kanban_parada:o1:e1:r1", severidade: "atencao", titulo: 'Oportunidade parada em "Novo"', tipoEntidade: "oportunidade", entidadeId: "o1", responsavelId: "juliana" };

  it("ultrapassa o tempo da etapa → alerta; move de etapa → resolve automaticamente", async () => {
    config.regrasKanban = [{ id: "r1" }];
    det.kanban.mockResolvedValue({ tipos: ["oportunidade_parada"], ativas: [parada] });
    await verificarAlertas(CLINICA);
    expect(alertas()[0]).toMatchObject({ tipo: "oportunidade_parada", categoria: "KANBAN", status: "aberto" });

    await resolverPorEvento(CLINICA, { tipos: ["oportunidade_parada"], tipoEntidade: "oportunidade", entidadeId: "o1", evento: "oportunidade_movida", atorId: "juliana" });
    expect(alertas()[0]).toMatchObject({ status: "resolvido", resolvido_por_evento: "oportunidade_movida" });
  });

  it("voltar à mesma etapa depois de resolvido = ocorrência NOVA", async () => {
    det.kanban.mockResolvedValue({ tipos: ["oportunidade_parada"], ativas: [parada] });
    await verificarAlertas(CLINICA);
    await resolverPorEvento(CLINICA, { tipos: ["oportunidade_parada"], tipoEntidade: "oportunidade", entidadeId: "o1", evento: "oportunidade_movida" });
    await verificarAlertas(CLINICA);
    expect(alertas()).toHaveLength(2);
    expect(alertas().filter((a) => a.status === "aberto")).toHaveLength(1);
  });

  it("o Kanban recebe o conjunto de conversas com SLA ativo (não repete o mesmo problema)", async () => {
    cenarioConversas([slaCond("atencao")]);
    await verificarAlertas(CLINICA);
    expect(det.kanban).toHaveBeenCalledWith(expect.anything(), new Set(["c1"]));
  });
});

describe("canal", () => {
  const canalCond: Condicao = { tipo: "canal_desconectado", chave: "canal:k1", severidade: "critico", titulo: "Canal desconectado", tipoEntidade: "canal", entidadeId: "k1", responsavelId: null };

  it("desconectado → alerta crítico; reconecta → resolve com motivo do detector", async () => {
    det.canais.mockResolvedValue({ tipos: ["canal_desconectado"], ativas: [canalCond], motivoEncerramento: "canal_recuperado" });
    await verificarAlertas(CLINICA);
    expect(alertas()[0]).toMatchObject({ categoria: "CANAL", severidade: "critico", status: "aberto" });

    det.canais.mockResolvedValue({ tipos: ["canal_desconectado"], ativas: [], motivoEncerramento: "canal_recuperado" });
    await verificarAlertas(CLINICA);
    expect(alertas()[0]).toMatchObject({ status: "resolvido", resolvido_por_evento: "canal_recuperado" });
  });
});

describe("fluxo", () => {
  it("execução falha definitivamente → alerta; some da janela → continua aberto (fato, só a pessoa encerra)", async () => {
    const falha: Condicao = { tipo: "fluxo_falhou", chave: "fluxo_falhou:e1", severidade: "atencao", titulo: "Fluxo de conversa falhou", tipoEntidade: "fluxo_execucao", entidadeId: "e1", responsavelId: null };
    det.fluxos.mockResolvedValue({ falhou: { tipos: ["fluxo_falhou"], ativas: [falha] }, preso: vazio(["fluxo_preso"]), indisponivel: vazio(["automacao_indisponivel"]) });
    await verificarAlertas(CLINICA);
    det.fluxos.mockResolvedValue({ falhou: vazio(["fluxo_falhou"]), preso: vazio(["fluxo_preso"]), indisponivel: vazio(["automacao_indisponivel"]) });
    await verificarAlertas(CLINICA);
    expect(alertas()[0]).toMatchObject({ tipo: "fluxo_falhou", status: "aberto", natureza: "operacional" });
  });

  it("execução travada é alerta TÉCNICO e se resolve sozinho quando o motor retoma", async () => {
    const preso: Condicao = { tipo: "fluxo_preso", chave: "fluxo_preso:e2", severidade: "atencao", titulo: "Execução de fluxo travada", tipoEntidade: "fluxo_execucao", entidadeId: "e2", responsavelId: null };
    det.fluxos.mockResolvedValue({ falhou: vazio(["fluxo_falhou"]), preso: { tipos: ["fluxo_preso"], ativas: [preso] }, indisponivel: vazio(["automacao_indisponivel"]) });
    await verificarAlertas(CLINICA);
    expect(alertas()[0]).toMatchObject({ natureza: "tecnico" });
    det.fluxos.mockResolvedValue({ falhou: vazio(["fluxo_falhou"]), preso: vazio(["fluxo_preso"]), indisponivel: vazio(["automacao_indisponivel"]) });
    await verificarAlertas(CLINICA);
    expect(alertas()[0].status).toBe("resolvido");
  });
});

describe("robustez", () => {
  it("detector falhou (ex.: banco instável): NÃO resolve nada daquele grupo — falta de dado não é 'condição acabou'", async () => {
    cenarioConversas([slaCond("critico")]);
    await verificarAlertas(CLINICA);

    det.conversas.mockRejectedValue(new Error("conversas_PGRST000"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await verificarAlertas(CLINICA);
    expect(r.deteccoesComFalha).toContain("conversas");
    expect(alertas()[0].status).toBe("aberto");
    // Kanban depende do resultado de conversas: sem ele, pula a rodada em vez de arriscar duplicar.
    expect(det.kanban).toHaveBeenCalledTimes(1);
  });

  it("tipo desabilitado na configuração: não detecta e o que estava aberto sai da fila (motivo registrado)", async () => {
    cenarioConversas([slaCond("critico")]);
    await verificarAlertas(CLINICA);
    config.tiposDesabilitados = new Set(["sla_limite"]);
    await verificarAlertas(CLINICA);
    expect(alertas()[0]).toMatchObject({ status: "resolvido", resolvido_por_evento: "tipo_desabilitado" });
  });

  it("clínicas isoladas: alerta de uma nunca é resolvido/tocado pela verificação de outra", async () => {
    cenarioConversas([slaCond("critico")]);
    await verificarAlertas("clinica-A");
    cenarioConversas([]);
    await verificarAlertas("clinica-B");
    expect(alertas().find((a) => a.clinica_id === "clinica-A")?.status).toBe("aberto");
  });

  it("com lock ocupado: verificação é pulada, sem erro", async () => {
    vi.mocked(adquirirLock).mockResolvedValueOnce({ ok: false, error: "ocupado" });
    const r = await verificarAlertasComLock(CLINICA);
    expect(r.pulada).toBe(true);
    expect(det.conversas).not.toHaveBeenCalled();
  });
});
