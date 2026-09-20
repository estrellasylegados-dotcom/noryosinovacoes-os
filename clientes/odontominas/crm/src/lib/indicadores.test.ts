import { describe, expect, it } from "vitest";
import { calcularIndicadores, type DadosIndicadores } from "@/lib/indicadores";

const INICIO = new Date("2026-09-01T00:00:00.000Z");
const FIM = new Date("2026-09-30T23:59:59.999Z");
const AGORA = new Date("2026-09-20T15:00:00.000Z");

function base(): DadosIndicadores {
  return {
    estagios: [
      { id: "novo", nome: "Novo", ordem: 1, tipo: "open", cor: "#dc2626", ativo: true },
      { id: "agendado", nome: "Agendado", ordem: 2, tipo: "open", cor: "#0d9488", ativo: true },
      { id: "ganho", nome: "Convertido", ordem: 3, tipo: "won", cor: "#059669", ativo: true },
      { id: "perdido", nome: "Perdido", ordem: 4, tipo: "lost", cor: "#6b7280", ativo: true },
    ],
    pacientes: [
      { id: "p1", nome: "Maria", origem_lead: "Instagram", utm_source: null },
      { id: "p2", nome: "[TESTE] João", origem_lead: null, utm_source: null },
      { id: "p3", nome: "Ana", origem_lead: null, utm_source: null },
    ],
    conversas: [
      { id: "c1", paciente_id: "p1", atribuido_a: "a1", canal_id: "canal-1", status: "respondido", finalizada_em: null, arquivada: false },
      { id: "c2", paciente_id: "p2", atribuido_a: null, canal_id: "canal-2", status: "novo", finalizada_em: null, arquivada: false },
      { id: "c3", paciente_id: "p3", atribuido_a: "a2", canal_id: "canal-1", status: "perdido", finalizada_em: "2026-09-10T12:00:00.000Z", arquivada: false },
    ],
    oportunidades: [
      { id: "o1", paciente_id: "p1", conversa_id: "c1", estagio_id: "ganho", responsavel_id: "a1", status: "won", estagio_entrou_em: "2026-09-05T11:00:00.000Z", converted_at: "2026-09-05T11:00:00.000Z", lost_at: null, created_at: "2026-09-02T10:00:00.000Z" },
      { id: "o2", paciente_id: "p2", conversa_id: "c2", estagio_id: "novo", responsavel_id: null, status: "open", estagio_entrou_em: "2026-09-20T13:00:00.000Z", converted_at: null, lost_at: null, created_at: "2026-09-20T13:00:00.000Z" },
      { id: "o3", paciente_id: "p3", conversa_id: "c3", estagio_id: "perdido", responsavel_id: "a2", status: "lost", estagio_entrou_em: "2026-09-10T12:00:00.000Z", converted_at: null, lost_at: "2026-09-10T12:00:00.000Z", created_at: "2026-09-03T10:00:00.000Z" },
    ],
    historico: [
      { id: "h1", oportunidade_id: "o1", tipo: "created", estagio_para: "novo", responsavel_para: "a1", created_at: "2026-09-02T10:00:00.000Z" },
      { id: "h2", oportunidade_id: "o1", tipo: "stage_changed", estagio_de: "novo", estagio_para: "agendado", created_at: "2026-09-04T10:00:00.000Z" },
      { id: "h3", oportunidade_id: "o1", tipo: "stage_changed", estagio_de: "agendado", estagio_para: "ganho", created_at: "2026-09-05T11:00:00.000Z" },
      { id: "h4", oportunidade_id: "o2", tipo: "created", estagio_para: "novo", responsavel_para: null, created_at: "2026-09-20T13:00:00.000Z" },
      { id: "h5", oportunidade_id: "o3", tipo: "created", estagio_para: "novo", responsavel_para: "a1", created_at: "2026-09-03T10:00:00.000Z" },
      { id: "h6", oportunidade_id: "o3", tipo: "owner_changed", responsavel_de: "a1", responsavel_para: "a2", created_at: "2026-09-09T10:00:00.000Z" },
      { id: "h7", oportunidade_id: "o3", tipo: "stage_changed", estagio_de: "novo", estagio_para: "perdido", created_at: "2026-09-10T12:00:00.000Z" },
    ],
    mensagens: [
      { id: "m1", conversa_id: "c1", direcao: "recebida", enviada_por_atendente_id: null, created_at: "2026-09-02T10:00:00.000Z" },
      { id: "m2", conversa_id: "c1", direcao: "enviada", enviada_por_atendente_id: "a1", created_at: "2026-09-02T10:10:00.000Z" },
      { id: "m3", conversa_id: "c2", direcao: "recebida", enviada_por_atendente_id: null, created_at: "2026-09-20T13:00:00.000Z" },
    ],
    atendentes: [
      { id: "a1", nome: "Beatriz", perfil: "atendente", status: "active" },
      { id: "a2", nome: "Carla", perfil: "supervisora", status: "active" },
      { id: "platform", nome: "Noryos", perfil: "noryos_admin", status: "active" },
      { id: "inativa", nome: "Inativa", perfil: "atendente", status: "inactive" },
    ],
    canais: [
      { id: "canal-1", nome: "WhatsApp", ativo: true },
      { id: "canal-2", nome: "[TESTE] Canal", ativo: true },
    ],
    regrasKanban: [{ estagioId: "novo", limiteMinutos: 30, ativo: true }],
    slaAtual: [
      { conversaId: "c1", atribuidoAId: "a1", status: { tipo: "ok", cicloTipo: "resposta_atendimento", cicloMensagemId: "m1", cicloInicioEm: "2026-09-02T10:00:00.000Z", limiteMinutos: 30, minutosConsumidos: 10, percentual: 33 } },
      { conversaId: "c2", atribuidoAId: null, status: { tipo: "breached", cicloTipo: "primeira_resposta", cicloMensagemId: "m3", cicloInicioEm: "2026-09-20T13:00:00.000Z", limiteMinutos: 15, minutosConsumidos: 120, percentual: 800 } },
    ],
    slaAtivo: false,
    slaConsiderarHorarioUtil: false,
    horario: null,
    horarioConfigurado: false,
  };
}

describe("calcularIndicadores", () => {
  it("resume oportunidade, movimentos, fechamento, funil e dados de teste sem duplicar eventos", () => {
    const r = calcularIndicadores(base(), { inicio: INICIO, fim: FIM }, AGORA);

    expect(r.kpis).toEqual({
      oportunidades: 3,
      avancaram: 2,
      abertas: 1,
      agendadas: 1,
      convertidas: 1,
      perdidas: 1,
      taxaFechamento: 50,
    });
    expect(r.funil.find((e) => e.nome === "Novo")).toMatchObject({ quantidade: 1, paradas: 1, limiteParadaMinutos: 30 });
    expect(r.qualidade.oportunidadesDemonstracao).toBe(1);
    expect(r.tendencia.oportunidades.reduce((soma, valor) => soma + valor, 0)).toBe(3);
    expect(r.tendencia.convertidas.reduce((soma, valor) => soma + valor, 0)).toBe(1);
    expect(r.origem).toMatchObject({ cobertura: 1, total: 3 });
  });

  it("mede atendimento humano, fila sem responsável e SLA atual", () => {
    const r = calcularIndicadores(base(), { inicio: INICIO, fim: FIM }, AGORA);

    expect(r.atendimento).toMatchObject({
      conversasRecebidas: 2,
      conversasAtendidas: 1,
      semResponsavel: 1,
      primeiraRespostaMediaMinutos: 10,
      primeiraRespostaMedianaMinutos: 10,
      amostrasPrimeiraResposta: 1,
      slaDentro: 1,
      slaEstourado: 1,
    });
  });

  it("mede a primeira resposta do recorte, sem confundir com um ciclo anterior da conversa", () => {
    const dados = base();
    dados.mensagens = [
      { id: "antiga-in", conversa_id: "c1", direcao: "recebida", enviada_por_atendente_id: null, created_at: "2026-08-20T10:00:00.000Z" },
      { id: "antiga-out", conversa_id: "c1", direcao: "enviada", enviada_por_atendente_id: "a1", created_at: "2026-08-20T10:05:00.000Z" },
      { id: "nova-in", conversa_id: "c1", direcao: "recebida", enviada_por_atendente_id: null, created_at: "2026-09-02T10:00:00.000Z" },
      { id: "nova-out", conversa_id: "c1", direcao: "enviada", enviada_por_atendente_id: "a1", created_at: "2026-09-02T10:20:00.000Z" },
    ];
    const r = calcularIndicadores(dados, { inicio: INICIO, fim: FIM }, AGORA);
    expect(r.atendimento.conversasRecebidas).toBe(1);
    expect(r.atendimento.conversasAtendidas).toBe(1);
    expect(r.atendimento.primeiraRespostaMediaMinutos).toBe(20);
  });

  it("atribui agendamento e conversão ao responsável no momento do evento e exclui perfis de plataforma", () => {
    const r = calcularIndicadores(base(), { inicio: INICIO, fim: FIM }, AGORA);
    expect(r.equipe.map((p) => p.nome)).toEqual(["Beatriz", "Carla"]);
    expect(r.equipe.find((p) => p.id === "a1")).toMatchObject({ agendamentos: 1, conversoes: 1, primeiraRespostaMediaMinutos: 10 });
    expect(r.equipe.find((p) => p.id === "a2")).toMatchObject({ agendamentos: 0, conversoes: 0 });
  });

  it("aplica os filtros de responsável e canal aos indicadores", () => {
    const porResponsavel = calcularIndicadores(base(), { inicio: INICIO, fim: FIM, responsavelId: "a1" }, AGORA);
    expect(porResponsavel.kpis.oportunidades).toBe(1);
    expect(porResponsavel.kpis.convertidas).toBe(1);
    expect(porResponsavel.equipe).toHaveLength(1);

    const porCanal = calcularIndicadores(base(), { inicio: INICIO, fim: FIM, canalId: "canal-2" }, AGORA);
    expect(porCanal.kpis.oportunidades).toBe(1);
    expect(porCanal.atendimento.conversasRecebidas).toBe(1);
    expect(porCanal.canais).toEqual([{ id: "canal-2", nome: "[TESTE] Canal", oportunidades: 1, convertidas: 0, taxaFechamento: null }]);
  });

  it("usa tempo corrido para resposta, mas não fabrica conformidade de SLA sem horário configurado", () => {
    const dados = base();
    dados.slaAtivo = true;
    dados.slaConsiderarHorarioUtil = true;
    const r = calcularIndicadores(dados, { inicio: INICIO, fim: FIM }, AGORA);
    expect(r.atendimento.primeiraRespostaMediaMinutos).toBe(10);
    expect(r.atendimento.amostrasPrimeiraResposta).toBe(1);
    expect(r.atendimento.primeiraRespostaModo).toBe("tempo_corrido");
    expect(r.atendimento.slaDisponivel).toBe(false);
  });

  it("devolve estado vazio estável", () => {
    const dados = base();
    dados.oportunidades = [];
    dados.historico = [];
    dados.conversas = [];
    dados.mensagens = [];
    dados.slaAtual = [];
    const r = calcularIndicadores(dados, { inicio: INICIO, fim: FIM }, AGORA);
    expect(r.kpis.oportunidades).toBe(0);
    expect(r.kpis.taxaFechamento).toBeNull();
    expect(r.atendimento.conversasRecebidas).toBe(0);
  });
});
