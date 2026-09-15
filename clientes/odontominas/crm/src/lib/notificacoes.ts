import { listarConversasChat } from "@/lib/chat";
import { buscarResumoExecutivo } from "@/lib/resumo";
import { formatDuracao, formatTelefone } from "@/lib/tempo";

/**
 * Sino de notificações (2026-09-15, a pedido do Rafael): não inventa dado
 * novo nem tabela nova — junta o que já é rastreado (conversa não lida do
 * Chat ao Vivo, lead esfriando do Resumo) numa lista só. Se um dia crescer
 * pra notificação persistente/lida-não-lida de verdade, aí sim vira tabela.
 */

export type Notificacao = {
  id: string;
  tipo: "nao_lida" | "esfriando";
  titulo: string;
  subtitulo: string;
  href: string;
};

const LIMITE_POR_TIPO = 8;

export async function buscarNotificacoes(clinicaId: string): Promise<Notificacao[]> {
  const [conversasChat, resumo] = await Promise.all([listarConversasChat(clinicaId), buscarResumoExecutivo(clinicaId)]);

  const naoLidas: Notificacao[] = conversasChat
    .filter((c) => c.naoLida && !c.arquivada)
    .slice(0, LIMITE_POR_TIPO)
    .map((c) => ({
      id: `nao_lida:${c.id}`,
      tipo: "nao_lida" as const,
      titulo: c.pacienteNome || formatTelefone(c.telefone),
      subtitulo: c.ultimaMensagemPreview || "Mensagem nova",
      href: "/chat",
    }));

  const esfriando: Notificacao[] = resumo.leadsEsfriando.slice(0, LIMITE_POR_TIPO).map((c) => ({
    id: `esfriando:${c.id}`,
    tipo: "esfriando" as const,
    titulo: c.pacienteNome || formatTelefone(c.telefone),
    subtitulo: `esperando há ${formatDuracao(c.tempoPrimeiraRespostaMs ?? 0)}`,
    href: c.pacienteId ? `/pacientes/${c.pacienteId}` : "/",
  }));

  return [...naoLidas, ...esfriando];
}
