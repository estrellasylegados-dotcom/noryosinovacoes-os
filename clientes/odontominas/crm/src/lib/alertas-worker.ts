import { getClinicaId } from "@/lib/clinica";
import { verificarAlertasComLock } from "@/lib/alertas-verificador";

/**
 * Worker do verificador de alertas — mesmo desenho de fluxo-worker.ts e
 * disparos-worker.ts: `setTimeout` recursivo (nunca `setInterval`: zero
 * sobreposição de ciclo) e lock em `integration_locks` (provider 'alertas'),
 * então um deploy com 2 instâncias rodando juntas não duplica trabalho. Um
 * ciclo por minuto: SLA/etapa/sem dono se medem em minutos; menos que isso
 * seria carga sem ganho, mais que isso atrasaria o alerta de SLA em 80%.
 */

const INTERVALO_MS = 60_000;
const PRIMEIRO_CICLO_MS = 20_000;

async function ciclo(): Promise<void> {
  try {
    const clinicaId = await getClinicaId();
    if (clinicaId) await verificarAlertasComLock(clinicaId);
  } catch (e) {
    console.error("[alertas-worker] ciclo_falhou", JSON.stringify({ message: (e as Error).message }));
  } finally {
    setTimeout(ciclo, INTERVALO_MS);
  }
}

let cicloAgendado = false;

/** Chamada uma vez por `src/instrumentation.ts` quando o processo sobe (produção). Idempotente. */
export function iniciarWorkerAlertas(): void {
  if (cicloAgendado) return;
  cicloAgendado = true;
  console.log("[alertas-worker] iniciado");
  setTimeout(ciclo, PRIMEIRO_CICLO_MS);
}
