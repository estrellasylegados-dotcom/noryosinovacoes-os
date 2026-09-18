import { describe, expect, it } from "vitest";
import {
  avaliarHorarioAtendimento,
  calcularProximoHorario,
  timezoneValido,
  validarConfiguracaoHorario,
  type ConfiguracaoHorario,
} from "@/lib/horario-atendimento";

/**
 * Datas de referência: 2024-01-01 é segunda-feira (fato verificável), então
 * toda a semana fica determinística por soma de dias:
 * 01=seg, 02=ter, 03=qua, 04=qui, 05=sex, 06=sáb, 07=dom, 08=seg (semana seguinte).
 *
 * America/Sao_Paulo não observa horário de verão desde 2019 — offset fixo
 * UTC-3 em todo o período testado, então `local = UTC - 3h` / `UTC = local + 3h`.
 */
const TZ = "America/Sao_Paulo";

const CONFIG_PADRAO: ConfiguracaoHorario = {
  timezone: TZ,
  periodos: [
    { diaSemana: 1, horaInicio: "08:00", horaFim: "18:00" }, // segunda
    { diaSemana: 2, horaInicio: "08:00", horaFim: "18:00" }, // terça
    { diaSemana: 3, horaInicio: "08:00", horaFim: "18:00" }, // quarta
    { diaSemana: 4, horaInicio: "08:00", horaFim: "18:00" }, // quinta
    { diaSemana: 5, horaInicio: "08:00", horaFim: "18:00" }, // sexta
    { diaSemana: 6, horaInicio: "08:00", horaFim: "12:00" }, // sábado
    // domingo (0): sem período = fechado
  ],
};

const SEM_CONFIGURACAO: ConfiguracaoHorario = { timezone: TZ, periodos: [] };

describe("avaliarHorarioAtendimento", () => {
  it("segunda 10:00 dentro de 08-18 → aberto", () => {
    // segunda 10:00 local = 13:00 UTC
    expect(avaliarHorarioAtendimento(CONFIG_PADRAO, new Date("2024-01-01T13:00:00Z"))).toEqual({
      dentro: true,
      motivo: "dentro_periodo",
    });
  });

  it("segunda 07:00 (antes de abrir) → fechado", () => {
    // segunda 07:00 local = 10:00 UTC
    expect(avaliarHorarioAtendimento(CONFIG_PADRAO, new Date("2024-01-01T10:00:00Z"))).toEqual({
      dentro: false,
      motivo: "fora_periodo",
    });
  });

  it("segunda 18:01 (depois de fechar) → fechado", () => {
    // segunda 18:01 local = 21:01 UTC
    expect(avaliarHorarioAtendimento(CONFIG_PADRAO, new Date("2024-01-01T21:01:00Z"))).toEqual({
      dentro: false,
      motivo: "fora_periodo",
    });
  });

  it("18:00 exato é fechado (fim exclusivo, não inclusivo)", () => {
    expect(avaliarHorarioAtendimento(CONFIG_PADRAO, new Date("2024-01-01T21:00:00Z"))).toEqual({
      dentro: false,
      motivo: "fora_periodo",
    });
  });

  it("domingo (fechado, zero períodos) → fechado, motivo dia_fechado", () => {
    // domingo 10:00 local = 13:00 UTC, 2024-01-07
    expect(avaliarHorarioAtendimento(CONFIG_PADRAO, new Date("2024-01-07T13:00:00Z"))).toEqual({
      dentro: false,
      motivo: "dia_fechado",
    });
  });

  it("sábado 10:00 dentro de 08-12 → aberto", () => {
    // sábado 10:00 local = 13:00 UTC, 2024-01-06
    expect(avaliarHorarioAtendimento(CONFIG_PADRAO, new Date("2024-01-06T13:00:00Z"))).toEqual({
      dentro: true,
      motivo: "dentro_periodo",
    });
  });

  it("timezone correto: 12:00 UTC de sábado é 09:00 local (aberto), não 12:00 local (que seria fechado)", () => {
    // Prova que a conversão de fato acontece: se o código tratasse o horário
    // UTC como se já fosse local (bug comum), 12:00 cairia fora de [08:00,12:00)
    // e o resultado seria fechado — o correto é aberto, porque local é 09:00.
    expect(avaliarHorarioAtendimento(CONFIG_PADRAO, new Date("2024-01-06T12:00:00Z"))).toEqual({
      dentro: true,
      motivo: "dentro_periodo",
    });
  });

  it("virada de dia: segunda 23:59 local → fechado (não vaza pro período de terça)", () => {
    // segunda 23:59 local = terça 02:59 UTC
    expect(avaliarHorarioAtendimento(CONFIG_PADRAO, new Date("2024-01-02T02:59:00Z"))).toEqual({
      dentro: false,
      motivo: "fora_periodo",
    });
  });

  it("virada de dia: segunda 00:00 local (início do dia) → fechado (antes de abrir)", () => {
    // segunda 00:00 local = 03:00 UTC
    expect(avaliarHorarioAtendimento(CONFIG_PADRAO, new Date("2024-01-01T03:00:00Z"))).toEqual({
      dentro: false,
      motivo: "fora_periodo",
    });
  });

  it("clínica sem configuração nenhuma → sempre dentro (comportamento seguro documentado: nunca bloqueia por falta de config)", () => {
    expect(avaliarHorarioAtendimento(SEM_CONFIGURACAO, new Date("2024-01-01T13:00:00Z"))).toEqual({
      dentro: true,
      motivo: "sem_configuracao",
    });
    // até domingo de madrugada, sem config, continua "dentro"
    expect(avaliarHorarioAtendimento(SEM_CONFIGURACAO, new Date("2024-01-07T05:00:00Z"))).toEqual({
      dentro: true,
      motivo: "sem_configuracao",
    });
  });

  it("dois períodos no mesmo dia (ex. 08-12 e 14-18): aberto nos dois, fechado no intervalo entre eles", () => {
    const configDoisPeriodos: ConfiguracaoHorario = {
      timezone: TZ,
      periodos: [
        { diaSemana: 1, horaInicio: "08:00", horaFim: "12:00" },
        { diaSemana: 1, horaInicio: "14:00", horaFim: "18:00" },
      ],
    };
    // segunda 09:00 local = 12:00 UTC → dentro do 1º período
    expect(avaliarHorarioAtendimento(configDoisPeriodos, new Date("2024-01-01T12:00:00Z")).dentro).toBe(true);
    // segunda 13:00 local = 16:00 UTC → no intervalo do almoço, fechado
    expect(avaliarHorarioAtendimento(configDoisPeriodos, new Date("2024-01-01T16:00:00Z")).dentro).toBe(false);
    // segunda 15:00 local = 18:00 UTC → dentro do 2º período
    expect(avaliarHorarioAtendimento(configDoisPeriodos, new Date("2024-01-01T18:00:00Z")).dentro).toBe(true);
  });
});

describe("calcularProximoHorario", () => {
  it("sexta 19:00 (fechado) → próximo é sábado 08:00 (CONFIG_PADRAO tem sábado 08-12 aberto, mais perto que segunda)", () => {
    // sexta 19:00 local = 22:00 UTC, 2024-01-05
    const proximo = calcularProximoHorario(CONFIG_PADRAO, new Date("2024-01-05T22:00:00Z"));
    // sábado seguinte 2024-01-06 08:00 local = 11:00 UTC
    expect(proximo?.toISOString()).toBe("2024-01-06T11:00:00.000Z");
  });

  it("sexta 19:00, com fim de semana TOTALMENTE fechado → próximo é segunda 08:00 (exemplo literal do enunciado)", () => {
    const configSemFimDeSemana: ConfiguracaoHorario = {
      timezone: TZ,
      periodos: CONFIG_PADRAO.periodos.filter((p) => p.diaSemana !== 6), // tira sábado, domingo já não tinha período
    };
    const proximo = calcularProximoHorario(configSemFimDeSemana, new Date("2024-01-05T22:00:00Z"));
    // segunda seguinte 2024-01-08 08:00 local = 11:00 UTC
    expect(proximo?.toISOString()).toBe("2024-01-08T11:00:00.000Z");
  });

  it("sábado 13:00 (depois do período de sábado) → próximo é segunda 08:00", () => {
    // sábado 13:00 local = 16:00 UTC, 2024-01-06
    const proximo = calcularProximoHorario(CONFIG_PADRAO, new Date("2024-01-06T16:00:00Z"));
    expect(proximo?.toISOString()).toBe("2024-01-08T11:00:00.000Z");
  });

  it("domingo 10:00 (fechado) → próximo é segunda 08:00", () => {
    // domingo 10:00 local = 13:00 UTC, 2024-01-07
    const proximo = calcularProximoHorario(CONFIG_PADRAO, new Date("2024-01-07T13:00:00Z"));
    expect(proximo?.toISOString()).toBe("2024-01-08T11:00:00.000Z");
  });

  it("segunda 10:00 (já dentro do período) → próximo é o período seguinte (sábado 08:00), não 'agora'", () => {
    const proximo = calcularProximoHorario(CONFIG_PADRAO, new Date("2024-01-01T13:00:00Z"));
    // terça a sexta são o mesmo período (08-18) que o de hoje já em andamento;
    // a função busca o próximo período que ainda não começou -- como a
    // config tem o mesmo horário todo dia útil, o "próximo" é o de amanhã
    // (terça 08:00 local = 11:00 UTC), não sábado.
    expect(proximo?.toISOString()).toBe("2024-01-02T11:00:00.000Z");
  });

  it("virada de dia: segunda 23:59 → próximo é terça 08:00 (não reaproveita o período de hoje, já encerrado)", () => {
    const proximo = calcularProximoHorario(CONFIG_PADRAO, new Date("2024-01-02T02:59:00Z"));
    expect(proximo?.toISOString()).toBe("2024-01-02T11:00:00.000Z");
  });

  it("sem configuração nenhuma → null (nada pra calcular)", () => {
    expect(calcularProximoHorario(SEM_CONFIGURACAO, new Date("2024-01-01T13:00:00Z"))).toBeNull();
  });

  it("configuração só com dias fechados (nenhum período em lugar nenhum) → null", () => {
    const todaFechada: ConfiguracaoHorario = { timezone: TZ, periodos: [] };
    expect(calcularProximoHorario(todaFechada, new Date("2024-01-01T13:00:00Z"))).toBeNull();
  });
});

describe("timezoneValido", () => {
  it("aceita America/Sao_Paulo", () => {
    expect(timezoneValido("America/Sao_Paulo")).toBe(true);
  });

  it("rejeita string vazia", () => {
    expect(timezoneValido("")).toBe(false);
  });

  it("rejeita timezone inventado", () => {
    expect(timezoneValido("Nao/Existe_Isso")).toBe(false);
  });
});

describe("validarConfiguracaoHorario", () => {
  const base = { timezone: TZ, periodos: [{ diaSemana: 1, horaInicio: "08:00", horaFim: "18:00" }] };

  it("aceita configuração válida", () => {
    expect(validarConfiguracaoHorario(base)).toBeNull();
  });

  it("aceita zero períodos (clínica fechando tudo de propósito)", () => {
    expect(validarConfiguracaoHorario({ timezone: TZ, periodos: [] })).toBeNull();
  });

  it("rejeita timezone inválido", () => {
    expect(validarConfiguracaoHorario({ ...base, timezone: "Nao/Existe" })).toBe("timezone_invalido");
  });

  it("rejeita dia da semana fora de 0-6", () => {
    expect(validarConfiguracaoHorario({ ...base, periodos: [{ diaSemana: 7, horaInicio: "08:00", horaFim: "18:00" }] })).toBe(
      "dia_semana_invalido"
    );
  });

  it("rejeita hora em formato inválido", () => {
    expect(validarConfiguracaoHorario({ ...base, periodos: [{ diaSemana: 1, horaInicio: "8:00", horaFim: "18:00" }] })).toBe(
      "horario_invalido"
    );
  });

  it("rejeita início >= fim", () => {
    expect(validarConfiguracaoHorario({ ...base, periodos: [{ diaSemana: 1, horaInicio: "18:00", horaFim: "08:00" }] })).toBe(
      "horario_inicio_maior_que_fim"
    );
    expect(validarConfiguracaoHorario({ ...base, periodos: [{ diaSemana: 1, horaInicio: "08:00", horaFim: "08:00" }] })).toBe(
      "horario_inicio_maior_que_fim"
    );
  });

  it("aceita dois períodos no mesmo dia sem sobreposição", () => {
    expect(
      validarConfiguracaoHorario({
        timezone: TZ,
        periodos: [
          { diaSemana: 1, horaInicio: "08:00", horaFim: "12:00" },
          { diaSemana: 1, horaInicio: "14:00", horaFim: "18:00" },
        ],
      })
    ).toBeNull();
  });

  it("rejeita dois períodos do mesmo dia se sobrepõem (dia duplicado indevidamente)", () => {
    expect(
      validarConfiguracaoHorario({
        timezone: TZ,
        periodos: [
          { diaSemana: 1, horaInicio: "08:00", horaFim: "13:00" },
          { diaSemana: 1, horaInicio: "12:00", horaFim: "18:00" },
        ],
      })
    ).toBe("periodos_sobrepostos");
  });
});
