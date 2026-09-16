import { getControleOdontoCapabilities } from "./capabilities";
import { getControleOdontoConfig } from "./config";
import type { ExternalAppointmentDTO } from "./types";

export interface AgendamentoLocalParaReconciliar {
  externalId: string;
  status: string;
  dataHora: string | null;
}

export interface DivergenciaReconciliacao {
  externalId: string;
  tipo: "faltando_localmente" | "divergente" | "cancelado_externamente";
  detalhe: string;
}

/**
 * Compara o que o CRM já tem contra o que a API retornou numa janela — pura,
 * sem I/O, testável com fixtures. Nunca apaga nada sozinha: só reporta
 * divergência pra decisão humana (ver pedido, seção RECONCILIAÇÃO — "sem
 * apagar dados automaticamente sem entender a semântica").
 */
export function diffAppointments(
  locais: AgendamentoLocalParaReconciliar[],
  remotos: ExternalAppointmentDTO[]
): DivergenciaReconciliacao[] {
  const divergencias: DivergenciaReconciliacao[] = [];
  const locaisPorId = new Map(locais.map((l) => [l.externalId, l]));

  for (const remoto of remotos) {
    const local = locaisPorId.get(remoto.externalId);

    if (!local) {
      divergencias.push({
        externalId: remoto.externalId,
        tipo: "faltando_localmente",
        detalhe: "existe na API, ainda não sincronizado localmente",
      });
      continue;
    }

    if (remoto.status === "cancelado" && local.status !== "cancelado") {
      divergencias.push({ externalId: remoto.externalId, tipo: "cancelado_externamente", detalhe: `local: ${local.status}` });
    } else if (local.status !== remoto.status) {
      divergencias.push({
        externalId: remoto.externalId,
        tipo: "divergente",
        detalhe: `local: ${local.status}, remoto: ${remoto.status}`,
      });
    }
  }

  return divergencias;
}

/** Guardada por capability — sem leitura de agenda confirmada, não há o que reconciliar de verdade ainda. */
export async function reconcileAppointments(): Promise<
  { ok: false; error: string } | { ok: true; divergencias: DivergenciaReconciliacao[] }
> {
  const capabilities = getControleOdontoCapabilities(getControleOdontoConfig());
  if (!capabilities.canReadAppointments) return { ok: false, error: "capability_desabilitada" };
  return { ok: false, error: "capability_desabilitada" };
}
