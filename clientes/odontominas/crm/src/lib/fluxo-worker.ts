import { getClinicaId } from "@/lib/clinica";
import { adquirirLock, liberarLock } from "@/lib/fluxo-lock";
import { processarProximoPassoDevido, recuperarExecucoesTravadas } from "@/lib/fluxo-execucoes";
import { processarEventoComercial } from "@/lib/fluxo-comercial";
import { processarAgendamentoReputacaoDevido } from "@/lib/reputacao-agendamentos";

/**
 * Worker do motor de Fluxo de Conversa — Fase 2a (ver
 * crm/docs/fluxo-conversa-arquitetura.md). Mesmo desenho de
 * `disparos-worker.ts`: `setTimeout` recursivo (nunca `setInterval` — zero
 * sobreposição de ciclo), lock via `integration_locks`
 * (`provider='fluxo_conversa'`), 1 execução `due` processada por ciclo.
 */

const RESOURCE = "engine";
const LOCK_TTL_MS = 60_000;
const POLL_OCIOSO_MS = 5_000;
const POLL_OCUPADO_MS = 3_000;
const POLL_IMEDIATO_MS = 500;

async function ciclo(): Promise<void> {
  let holder: string | null = null;
  let clinicaComLock: string | null = null;
  let proximoDelayMs = POLL_OCIOSO_MS;

  try {
    const clinicaId = await getClinicaId();
    if (!clinicaId) return;

    const lock = await adquirirLock(clinicaId, RESOURCE, LOCK_TTL_MS);
    if (!lock.ok || !lock.holder) {
      proximoDelayMs = POLL_OCUPADO_MS;
      return;
    }
    holder = lock.holder;
    clinicaComLock = clinicaId;

    const evento = await processarEventoComercial(clinicaId);
    const [processou, reputacao] = await Promise.all([processarProximoPassoDevido(clinicaId), processarAgendamentoReputacaoDevido(clinicaId)]);
    proximoDelayMs = processou || evento || reputacao ? POLL_IMEDIATO_MS : POLL_OCIOSO_MS;
  } catch (e) {
    console.error("[fluxo-worker] ciclo_falhou", JSON.stringify({ message: (e as Error).message }));
  } finally {
    if (holder && clinicaComLock) await liberarLock(clinicaComLock, RESOURCE, holder);
    setTimeout(ciclo, proximoDelayMs);
  }
}

let cicloAgendado = false;

/** Chamada uma vez por `src/instrumentation.ts` quando o processo sobe (produção). Idempotente. */
export function iniciarWorkerFluxo(): void {
  if (cicloAgendado) return;
  cicloAgendado = true;
  console.log("[fluxo-worker] iniciado");

  recuperarExecucoesTravadas()
    .catch((e) => console.error("[fluxo-worker] recovery_falhou", JSON.stringify({ message: (e as Error).message })))
    .finally(() => ciclo());
}
