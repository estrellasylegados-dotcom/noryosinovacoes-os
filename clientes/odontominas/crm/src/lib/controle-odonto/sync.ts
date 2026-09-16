import { getControleOdontoConfig } from "./config";
import { getControleOdontoCapabilities } from "./capabilities";
import { adquirirLock, liberarLock } from "./lock";
import { getSyncState, registrarSucessoSync, registrarFalhaSync } from "./sync-state";
import { registrarLog } from "./sync-log";
import { getAppointments } from "./appointments";
import { upsertExternalId } from "./external-ids";

export const RECURSO_AGENDAMENTOS = "agendamento";
const TTL_LOCK_MS = 5 * 60 * 1000;

export interface JanelaSync {
  inicio: Date;
  fim: Date;
}

/**
 * Janela incremental (seção POLLING do pedido): do último sucesso menos uma
 * margem (pega alteração atrasada) até agora mais um horizonte futuro (pega
 * consulta marcada com antecedência). Sem sucesso anterior, usa só a margem
 * pra trás a partir de agora — nunca varre o histórico inteiro da clínica.
 */
export function calcularJanelaSync(agora: Date, ultimoSucessoEm: Date | null, margemHoras: number, horizonteDias: number): JanelaSync {
  const margemMs = margemHoras * 60 * 60 * 1000;
  const horizonteMs = horizonteDias * 24 * 60 * 60 * 1000;
  const inicioPorMargem = agora.getTime() - margemMs;
  const inicio = ultimoSucessoEm ? Math.min(ultimoSucessoEm.getTime() - margemMs, inicioPorMargem) : inicioPorMargem;
  return { inicio: new Date(inicio), fim: new Date(agora.getTime() + horizonteMs) };
}

export type ResultadoSync =
  | { ok: true; status: "sincronizado"; quantidade: number; janela: JanelaSync }
  | { ok: false; status: "nao_configurado" | "aguardando_credencial" | "ocupado" | "erro"; error: string };

/**
 * Orquestra 1 rodada de sincronização de agenda. Sempre serializada por
 * lock (integration_locks) — o botão "Sincronizar agora" e o cron nunca
 * rodam juntos (seção CONCORRÊNCIA/LOCK DISTRIBUÍDO do pedido). Sem
 * `canReadAppointments` confirmada, encerra cedo sem tentar nenhuma chamada
 * HTTP real (ver appointments.ts) — só registra o motivo no log.
 */
export async function runAppointmentsSync(clinicaId: string): Promise<ResultadoSync> {
  const config = getControleOdontoConfig();
  const capabilities = getControleOdontoCapabilities(config);
  const startedAt = new Date();

  if (!config.enabled) {
    return { ok: false, status: "nao_configurado", error: "integracao_desligada" };
  }

  if (!capabilities.canReadAppointments) {
    await registrarLog({
      clinicaId,
      resource: RECURSO_AGENDAMENTOS,
      operation: "leitura",
      direction: "entrada",
      status: "ignorado",
      errorCode: "capability_desabilitada",
      startedAt,
      finishedAt: new Date(),
    });
    return { ok: false, status: "aguardando_credencial", error: "capability_canReadAppointments_desabilitada" };
  }

  const lock = await adquirirLock(clinicaId, RECURSO_AGENDAMENTOS, TTL_LOCK_MS);
  if (!lock.ok) return { ok: false, status: "ocupado", error: lock.error ?? "ocupado" };

  try {
    const estado = await getSyncState(clinicaId, RECURSO_AGENDAMENTOS);
    const janela = calcularJanelaSync(
      new Date(),
      estado?.lastSuccessAt ? new Date(estado.lastSuccessAt) : null,
      config.syncMargemHoras,
      config.syncHorizonteDias
    );

    const resultado = await getAppointments(janela.inicio, janela.fim);
    const finishedAt = new Date();
    const duracaoMs = finishedAt.getTime() - startedAt.getTime();

    if (!resultado.ok) {
      await registrarFalhaSync(clinicaId, RECURSO_AGENDAMENTOS, resultado.error);
      await registrarLog({
        clinicaId,
        resource: RECURSO_AGENDAMENTOS,
        operation: "leitura",
        direction: "entrada",
        status: "erro",
        errorCode: resultado.error,
        durationMs: duracaoMs,
        startedAt,
        finishedAt,
      });
      return { ok: false, status: "erro", error: resultado.error };
    }

    // Idempotência (seção IDEMPOTÊNCIA do pedido): cada agendamento externo
    // só marca presença 1x em external_ids (chave: clínica + provider +
    // tipo + id externo) — a mesma leitura repetida (polling encontrando o
    // mesmo agendamento de novo) faz upsert, nunca duplica.
    for (const agendamento of resultado.agendamentos) {
      await upsertExternalId(clinicaId, "consulta", agendamento.externalId, {
        metadata: { rawStatus: agendamento.rawStatus, status: agendamento.status },
      });
    }

    await registrarSucessoSync(clinicaId, RECURSO_AGENDAMENTOS, {
      janelaInicio: janela.inicio,
      janelaFim: janela.fim,
      duracaoMs,
      quantidade: resultado.agendamentos.length,
    });
    await registrarLog({
      clinicaId,
      resource: RECURSO_AGENDAMENTOS,
      operation: "leitura",
      direction: "entrada",
      status: "sucesso",
      durationMs: duracaoMs,
      startedAt,
      finishedAt,
    });

    return { ok: true, status: "sincronizado", quantidade: resultado.agendamentos.length, janela };
  } finally {
    if (lock.holder) await liberarLock(clinicaId, RECURSO_AGENDAMENTOS, lock.holder);
  }
}
