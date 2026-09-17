import { getSupabaseServerClient } from "@/lib/supabase";
import { iniciarExecucaoFluxo } from "@/lib/fluxo-execucoes";
import { obterOuCriarConversaDoPaciente } from "@/lib/conversas";

/**
 * Fase 3 (scanner temporal genérico — ver _memoria/decisoes.md): infra
 * comum pra QUALQUER gatilho temporal, não um "cron-aniversario" isolado.
 * `aniversario` é a única regra concreta desta fase (ver
 * selecionarPacientesAniversario); `x_dias_sem_resposta`/
 * `x_meses_sem_atendimento`/`retorno_previsto` já são categorizados como
 * "temporal" (fluxo-gatilhos.ts) mas não têm regra escrita ainda — quando
 * tiverem, entram como mais um `if` dentro do loop de `executarScannerTemporal`,
 * reusando a mesma busca de fluxos/janela de horário/idempotência.
 *
 * Rodado por um cron QUALQUER frequência (não precisa ser exatamente 1x/dia
 * à meia-noite): a janela de horário configurada por fluxo
 * (`gatilho_config.horario`) decide QUANDO a regra realmente processa —
 * rodar o cron fora da janela é um no-op barato (1 SELECT em `fluxos`), e
 * rodar 2x dentro da mesma janela nunca duplica (idempotência via
 * `gatilho_dedupe_key`, mesmo índice único de sempre).
 */

export const TIMEZONE_PADRAO = "America/Sao_Paulo";

/** "HH" na timezone dada — usado pra casar com `gatilho_config.horario` ("09:00" → compara só "09"). */
export function horaAtualNaTimezone(agora: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false }).format(agora);
}

export function dentroDaJanela(agora: Date, horarioConfigurado: string | undefined, timezone: string): boolean {
  const horarioAlvo = (horarioConfigurado ?? "09:00").slice(0, 2);
  return horaAtualNaTimezone(agora, timezone) === horarioAlvo;
}

export type PacienteComNascimento = { id: string; dataNascimento: string | null };

/** Pura e testável: mês/dia de `dataNascimento` (formato "YYYY-MM-DD") bate com `hojeMesDia` ("MM-DD"). */
export function selecionarPacientesAniversario(pacientes: PacienteComNascimento[], hojeMesDia: string): string[] {
  return pacientes.filter((p) => p.dataNascimento && p.dataNascimento.slice(5, 10) === hojeMesDia).map((p) => p.id);
}

export type ResultadoScannerTemporal = { avaliados: number; iniciados: number; idempotentes: number; erros: number };

export async function executarScannerTemporal(clinicaId: string, agora: Date = new Date()): Promise<ResultadoScannerTemporal> {
  const vazio: ResultadoScannerTemporal = { avaliados: 0, iniciados: 0, idempotentes: 0, erros: 0 };
  const supabase = getSupabaseServerClient();
  if (!supabase) return vazio;

  const { data: fluxosAniversario } = await supabase
    .from("fluxos")
    .select("id, gatilho_config, pode_interromper_agente_ia")
    .eq("clinica_id", clinicaId)
    .eq("status", "ativo")
    .eq("gatilho_tipo", "aniversario");

  let avaliados = 0;
  let iniciados = 0;
  let idempotentes = 0;
  let erros = 0;

  for (const fluxo of fluxosAniversario ?? []) {
    const config = (fluxo.gatilho_config as Record<string, unknown>) ?? {};
    const timezone = typeof config.timezone === "string" ? config.timezone : TIMEZONE_PADRAO;
    if (!dentroDaJanela(agora, typeof config.horario === "string" ? config.horario : undefined, timezone)) continue;

    const hojeMesDia = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, month: "2-digit", day: "2-digit" }).format(agora);
    const ano = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric" }).format(agora);

    // Volume atual (1 clínica piloto) não justifica índice funcional por
    // mês/dia — filtro em aplicação, ver migration v21.
    const { data: pacientesRows } = await supabase
      .from("pacientes")
      .select("id, data_nascimento")
      .eq("clinica_id", clinicaId)
      .not("data_nascimento", "is", null);

    const pacientes: PacienteComNascimento[] = (pacientesRows ?? []).map((p) => ({
      id: p.id as string,
      dataNascimento: p.data_nascimento as string | null,
    }));
    const candidatoIds = selecionarPacientesAniversario(pacientes, hojeMesDia);
    avaliados += candidatoIds.length;

    for (const pacienteId of candidatoIds) {
      const conversaId = await obterOuCriarConversaDoPaciente(clinicaId, pacienteId);
      if (!conversaId) {
        erros++;
        continue;
      }

      const dedupeKey = `aniversario:${pacienteId}:${ano}`;
      const resultado = await iniciarExecucaoFluxo(
        clinicaId,
        fluxo.id as string,
        conversaId,
        pacienteId,
        { tipo: "aniversario", refId: pacienteId, dedupeKey },
        Boolean(fluxo.pode_interromper_agente_ia)
      );

      if (!resultado.ok) {
        erros++;
        await supabase.from("automacao_eventos").insert({
          clinica_id: clinicaId,
          paciente_id: pacienteId,
          fluxo_id: fluxo.id,
          evento_tipo: "aniversario",
          referencia_id: ano,
          resultado: "erro",
          detalhe: { motivo: resultado.error ?? "desconhecido" },
        });
        continue;
      }
      if (resultado.error === "ja_existe") {
        idempotentes++; // não registra individual — ruído esperado se o cron reprocessar a mesma janela (ver item 12 da decisão)
        continue;
      }

      iniciados++;
      await supabase.from("automacao_eventos").insert({
        clinica_id: clinicaId,
        paciente_id: pacienteId,
        fluxo_id: fluxo.id,
        execucao_id: resultado.execucaoId,
        evento_tipo: "aniversario",
        referencia_id: ano,
        resultado: "execucao_iniciada",
      });
    }
  }

  if (avaliados > 0 || iniciados > 0 || erros > 0) {
    await supabase.from("automacao_eventos").insert({
      clinica_id: clinicaId,
      evento_tipo: "aniversario",
      resultado: "resumo_agregado",
      detalhe: { avaliados, iniciados, idempotentes, erros },
    });
  }

  return { avaliados, iniciados, idempotentes, erros };
}
