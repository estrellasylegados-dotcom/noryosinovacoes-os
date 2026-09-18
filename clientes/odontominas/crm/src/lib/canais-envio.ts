import { enviarTextoEvolution, type EnvioResultado } from "@/lib/evolution-send";
import { buscarStatusConexao } from "@/lib/evolution-status";
import {
  apiKeyDoCanal,
  buscarCanalDaConversa,
  buscarCanalPrincipal,
  decidirEnvioCanal,
  registrarAtividadeCanal,
  type Canal,
} from "@/lib/canais";

/**
 * Único ponto de envio de WhatsApp do sistema: conversa → canal →
 * provider/instância → envio. Substitui o antigo `enviarMensagemWhatsapp`
 * (instância global). Regras:
 *  - canal pausado ou desconectado = falha CONTROLADA (`canal_pausado` /
 *    `canal_indisponivel`), nunca silenciosa;
 *  - NUNCA há fallback pra outro canal: o paciente não pode receber
 *    mensagem de um número diferente do que ele conhece.
 */

export type EnvioCanalResultado = EnvioResultado & { canalId?: string };

/** Erros de canal (vs. erro do provider): a UI mostra uma mensagem operacional específica. */
export const ERROS_DE_CANAL = ["canal_pausado", "canal_indisponivel", "canal_nao_encontrado", "provider_nao_suportado"] as const;

export function isErroDeCanal(error: string | undefined): boolean {
  return (ERROS_DE_CANAL as readonly string[]).includes(error ?? "");
}

export async function enviarPeloCanal(canal: Canal, telefone: string, texto: string): Promise<EnvioCanalResultado> {
  let decisao = decidirEnvioCanal(canal);
  if (!decisao.pode && decisao.error === "canal_indisponivel") {
    // Status salvo diz "fora do ar": confirma no provider antes de recusar (o salvo pode estar velho).
    const vivo = await buscarStatusConexao(canal.providerInstanceId);
    decisao = decidirEnvioCanal(canal, vivo.conectado === true);
  }

  if (!decisao.pode) {
    console.error(
      "[canais-envio] channel_unavailable",
      JSON.stringify({ canalId: canal.id, motivo: decisao.error, status: canal.status, ativo: canal.ativo })
    );
    return { ok: false, error: decisao.error, canalId: canal.id };
  }

  const resultado = await enviarTextoEvolution(canal.providerInstanceId, telefone, texto, apiKeyDoCanal(canal));
  console.log("[canais-envio] send_channel_selected", JSON.stringify({ canalId: canal.id, ok: resultado.ok, error: resultado.error ?? null }));

  if (resultado.ok) void registrarAtividadeCanal(canal, { tipo: "envio_ok" });
  else void registrarAtividadeCanal(canal, { tipo: "erro", mensagem: resultado.error ?? "envio_falhou" });

  return { ...resultado, canalId: canal.id };
}

/** Envio no contexto de uma conversa: usa o canal por onde ela entrou. */
export async function enviarNaConversa(
  clinicaId: string,
  conversaId: string,
  telefone: string,
  texto: string
): Promise<EnvioCanalResultado> {
  const canal = await buscarCanalDaConversa(clinicaId, conversaId);
  if (!canal) return { ok: false, error: "canal_nao_encontrado" };
  return enviarPeloCanal(canal, telefone, texto);
}

/** Envio sem conversa (disparo, alerta interno): canal principal da clínica — nunca um canal "qualquer". */
export async function enviarPeloCanalPrincipal(clinicaId: string, telefone: string, texto: string): Promise<EnvioCanalResultado> {
  const canal = await buscarCanalPrincipal(clinicaId);
  if (!canal) return { ok: false, error: "canal_nao_encontrado" };
  return enviarPeloCanal(canal, telefone, texto);
}

/** Mensagem operacional (em português) pra erro de envio — o que a atendente lê no Chat ao Vivo. */
export function mensagemErroEnvio(error: string | undefined): string {
  switch (error) {
    case "canal_pausado":
      return "Este canal está pausado. Ative o canal em Configurações → Canais para enviar mensagens.";
    case "canal_indisponivel":
      return "O WhatsApp deste canal está desconectado. Peça a quem administra para reconectar em Configurações → Canais.";
    case "canal_nao_encontrado":
      return "Esta conversa não está ligada a nenhum canal ativo.";
    case "provider_nao_suportado":
      return "Este tipo de canal ainda não permite envio pelo painel.";
    default:
      return "Não foi possível enviar a mensagem agora. Tente de novo em instantes.";
  }
}
