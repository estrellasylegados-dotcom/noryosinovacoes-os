import { getControleOdontoConfig } from "./config";
import { getControleOdontoCapabilities } from "./capabilities";
import { getControleOdonto } from "./client";
import type { ExternalAppointmentDTO } from "./types";

/**
 * Caminho citado como evidência externa no pedido original — não
 * confirmado de forma independente por esta pesquisa (ver
 * docs/integrations/controle-odonto.md, seção "CONFIRMADO POR EVIDÊNCIA
 * PÚBLICA"). Guardado aqui só como candidato: nunca é chamado de verdade
 * enquanto `canReadAppointments` for `false`, e o formato de data também
 * não está confirmado (ISO é o palpite mais defensável, ajustar quando
 * validar com credencial real).
 */
export const ENDPOINT_AGENDAMENTO_POR_ESTABELECIMENTO_CANDIDATO =
  "/v6/Agendamento/Estabelecimento/{dataInicio}/{dataFim}";

export type ResultadoAgendamentos = { ok: true; agendamentos: ExternalAppointmentDTO[] } | { ok: false; error: string };

function formatarDataISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/**
 * O formato real da resposta não está confirmado — esta função é o único
 * lugar a ajustar quando o contrato chegar. Até lá, qualquer formato
 * desconhecido vira lista vazia (nunca inventa campo) e fica registrado.
 */
function mapearRespostaAgendamentos(resposta: unknown): ExternalAppointmentDTO[] {
  if (!Array.isArray(resposta)) {
    console.error("[controle-odonto/appointments] payload_inesperado", JSON.stringify({ tipo: typeof resposta }));
    return [];
  }
  return [];
}

/**
 * Lê agendamentos de um período. Guardada por capability: sem
 * `canReadAppointments` confirmada, nunca chega a montar a chamada HTTP —
 * retorna cedo, sem tentar adivinhar contrato nenhum (ver pedido, seção
 * PRIMEIRA INTEGRAÇÃO REAL: AGENDA).
 */
export async function getAppointments(start: Date, end: Date): Promise<ResultadoAgendamentos> {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.getTime() > end.getTime()) {
    return { ok: false, error: "intervalo_invalido" };
  }

  const config = getControleOdontoConfig();
  const capabilities = getControleOdontoCapabilities(config);

  if (!config.enabled) return { ok: false, error: "nao_configurado" };
  if (!capabilities.canReadAppointments) return { ok: false, error: "capability_desabilitada" };
  if (!config.estabelecimentoId) return { ok: false, error: "estabelecimento_nao_configurado" };

  const caminho = ENDPOINT_AGENDAMENTO_POR_ESTABELECIMENTO_CANDIDATO.replace("{dataInicio}", formatarDataISO(start)).replace(
    "{dataFim}",
    formatarDataISO(end)
  );

  try {
    const resposta = await getControleOdonto<unknown>(caminho);
    return { ok: true, agendamentos: mapearRespostaAgendamentos(resposta) };
  } catch (erro) {
    console.error("[controle-odonto/appointments] get_appointments_failed", JSON.stringify({ message: (erro as Error)?.message }));
    return { ok: false, error: "falha_na_chamada" };
  }
}

/**
 * Interface preparada, sem endpoint/payload de escrita confirmado em
 * nenhum lugar público — `canCreateAppointments` fica `false` até existir
 * contrato real (ver pedido, seção CRIAÇÃO DE AGENDAMENTO PELO CRM).
 */
export async function createAppointment(): Promise<{ ok: false; error: string }> {
  return { ok: false, error: "capability_desabilitada" };
}

export async function cancelAppointment(): Promise<{ ok: false; error: string }> {
  return { ok: false, error: "capability_desabilitada" };
}

export async function rescheduleAppointment(): Promise<{ ok: false; error: string }> {
  return { ok: false, error: "capability_desabilitada" };
}
