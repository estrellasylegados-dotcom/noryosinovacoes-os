import { enviarMensagemWhatsapp } from "@/lib/evolution-send";
import { formatTelefone } from "@/lib/tempo";
import type { AgenteIA } from "@/lib/agentes";

/**
 * "Avisar Membro da Equipe" — a rede de segurança do Agente de IA (Fase 2A,
 * a pedido do Rafael): manda um WhatsApp pra número(s) interno(s) quando a
 * IA não sabe responder, o paciente pede um humano, mostra intenção de
 * agendar/comprar, ou é um lead novo. Detecção por palavra-chave, não IA —
 * decisão consciente: fica determinístico e testável, sem depender de um
 * modelo "entender" a intenção nem de parsing frágil de marcador entre 5
 * provedores diferentes.
 */

const PALAVRAS_PEDIDO_HUMANO = [
  "atendente",
  "humano",
  "pessoa de verdade",
  "falar com alguem",
  "falar com uma pessoa",
  "quero uma pessoa",
  "nao quero falar com robo",
  "nao e um robo",
  "nao e bot",
  "recepcionista",
  "secretaria",
];

const PALAVRAS_INTENCAO_COMPRA = [
  "agendar",
  "marcar",
  "quanto custa",
  "qual o valor",
  "qual o preco",
  "tem vaga",
  "disponibilidade",
  "quero fazer",
];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function detectarPedidoHumano(mensagem: string): boolean {
  const normalizado = normalizar(mensagem);
  return PALAVRAS_PEDIDO_HUMANO.some((p) => normalizado.includes(p));
}

export function detectarIntencaoCompra(mensagem: string): boolean {
  const normalizado = normalizar(mensagem);
  return PALAVRAS_INTENCAO_COMPRA.some((p) => normalizado.includes(p));
}

const TEMPLATE_PADRAO =
  "🔔 {motivo}\n👤 {nome}\n📱 {telefone}\n💬 \"{resumo}\"";

const LABEL_MOTIVO: Record<MotivoNotificacao, string> = {
  novo_lead: "Novo contato",
  pedido_humano: "Pedido de atendimento humano",
  fallback: "A IA não soube responder",
  intencao_compra: "Possível intenção de agendar",
};

export function montarMensagemNotificacao(
  template: string,
  vars: { motivo: string; nome: string; telefone: string; resumo: string }
): string {
  return template
    .replaceAll("{motivo}", vars.motivo)
    .replaceAll("{nome}", vars.nome)
    .replaceAll("{telefone}", vars.telefone)
    .replaceAll("{resumo}", vars.resumo);
}

export type MotivoNotificacao = "novo_lead" | "pedido_humano" | "fallback" | "intencao_compra";

const CAMPO_POR_MOTIVO: Record<MotivoNotificacao, keyof AgenteIA> = {
  novo_lead: "notificarNovoLead",
  pedido_humano: "notificarPedidoHumano",
  fallback: "notificarFallback",
  intencao_compra: "notificarIntencaoCompra",
};

/**
 * Manda a notificação pros números configurados no agente, se o motivo
 * estiver ligado. Silenciosa de propósito (nunca deve derrubar o fluxo
 * principal do agente por causa de um número inválido ou falha de envio).
 */
export async function notificarEquipe(
  agente: AgenteIA,
  motivo: MotivoNotificacao,
  params: { pacienteNome: string | null; telefone: string; resumo: string }
): Promise<void> {
  if (!agente[CAMPO_POR_MOTIVO[motivo]]) return;

  const numeros = (agente.notificarNumeros ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  if (numeros.length === 0) return;

  const texto = montarMensagemNotificacao(agente.mensagemNotificacao || TEMPLATE_PADRAO, {
    motivo: LABEL_MOTIVO[motivo],
    nome: params.pacienteNome ?? "Contato sem nome",
    telefone: formatTelefone(params.telefone),
    resumo: params.resumo.slice(0, 200),
  });

  for (const numero of numeros) {
    const envio = await enviarMensagemWhatsapp(numero, texto);
    if (!envio.ok) {
      console.error("[agentes-notificacoes] envio_failed", JSON.stringify({ motivo, numero, error: envio.error ?? null }));
    }
  }
}
