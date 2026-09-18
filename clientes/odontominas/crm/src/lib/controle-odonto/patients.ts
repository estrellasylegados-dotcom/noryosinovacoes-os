import { normalizarTelefoneEntrada } from "@/lib/chat";
import { variantesEquivalentesTelefoneBr } from "@/lib/telefone";
import { getControleOdontoConfig } from "./config";
import { getControleOdontoCapabilities } from "./capabilities";

export interface CandidatoPaciente {
  externalId: string | null;
  telefone: string | null;
  cpf: string | null;
  email: string | null;
}

export type ResultadoCorrespondencia =
  | { tipo: "external_id"; candidato: CandidatoPaciente }
  | { tipo: "telefone"; candidato: CandidatoPaciente }
  | { tipo: "cpf"; candidato: CandidatoPaciente }
  | { tipo: "email"; candidato: CandidatoPaciente }
  | { tipo: "needs_review" };

/**
 * Ordem de prioridade da seção MAPEAMENTO DE PACIENTE do pedido: id externo
 * já conhecido → telefone normalizado (reaproveita `normalizarTelefoneEntrada`
 * de chat.ts, nunca duplica a função) → CPF → e-mail → revisão manual.
 * Nunca casa por nome. Ambiguidade (mais de 1 candidato bate no mesmo
 * critério) nunca escolhe sozinha — vira `needs_review`, igual a nenhum
 * candidato encontrado (fuzzy matching automático é perigoso demais pra
 * fundir 2 pacientes errados). Pura, sem I/O: quem chama já trouxe os
 * candidatos buscados no Supabase.
 */
export function encontrarCorrespondenciaPaciente(
  entrada: { externalId?: string | null; telefone?: string | null; cpf?: string | null; email?: string | null },
  candidatos: CandidatoPaciente[]
): ResultadoCorrespondencia {
  if (entrada.externalId) {
    const encontrados = candidatos.filter((c) => c.externalId === entrada.externalId);
    if (encontrados.length > 1) return { tipo: "needs_review" };
    if (encontrados.length === 1) return { tipo: "external_id", candidato: encontrados[0] };
  }

  const telefoneNormalizado = entrada.telefone ? normalizarTelefoneEntrada(entrada.telefone) : null;
  if (telefoneNormalizado) {
    // Mesma compatibilidade de transição do webhook (ver telefone.ts): um
    // candidato pode estar gravado sem o 9º dígito do celular BR — nunca
    // fuzzy, só as formas equivalentes determinísticas.
    const variantes = variantesEquivalentesTelefoneBr(telefoneNormalizado);
    const encontrados = candidatos.filter((c) => c.telefone && variantes.includes(c.telefone));
    if (encontrados.length > 1) return { tipo: "needs_review" };
    if (encontrados.length === 1) return { tipo: "telefone", candidato: encontrados[0] };
  }

  if (entrada.cpf) {
    const encontrados = candidatos.filter((c) => c.cpf === entrada.cpf);
    if (encontrados.length > 1) return { tipo: "needs_review" };
    if (encontrados.length === 1) return { tipo: "cpf", candidato: encontrados[0] };
  }

  if (entrada.email) {
    const emailNormalizado = entrada.email.toLowerCase();
    const encontrados = candidatos.filter((c) => c.email?.toLowerCase() === emailNormalizado);
    if (encontrados.length > 1) return { tipo: "needs_review" };
    if (encontrados.length === 1) return { tipo: "email", candidato: encontrados[0] };
  }

  return { tipo: "needs_review" };
}

/** Sem endpoint de paciente confirmado publicamente — guardado, desabilitado até existir contrato real. */
export async function getPatient(): Promise<{ ok: false; error: string }> {
  const capabilities = getControleOdontoCapabilities(getControleOdontoConfig());
  if (!capabilities.canReadPatients) return { ok: false, error: "capability_desabilitada" };
  return { ok: false, error: "capability_desabilitada" };
}

export async function createPatient(): Promise<{ ok: false; error: string }> {
  const capabilities = getControleOdontoCapabilities(getControleOdontoConfig());
  if (!capabilities.canCreatePatients) return { ok: false, error: "capability_desabilitada" };
  return { ok: false, error: "capability_desabilitada" };
}
