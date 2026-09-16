import { getSupabaseServerClient } from "@/lib/supabase";

/**
 * Opt-out por palavra-chave (LGPD) — fundação da Fase A de Disparos (ver
 * auditoria: não existia opt-out em lugar nenhum do código antes disto).
 * Detecção determinística, mesmo espírito de `detectarPedidoHumano`
 * (`src/lib/agentes-notificacoes.ts`): sem depender de IA "entender" a
 * intenção, e funciona mesmo sem nenhum agente ativo na conversa — por isso
 * fica plugada direto no webhook, não dentro do fluxo do Agente de IA.
 *
 * Palavras soltas como "parar"/"sair" ficam de fora do casamento por
 * substring de propósito: aparecem em pergunta legítima de paciente
 * odontológico ("posso parar de usar o fio dental?"), e um falso positivo
 * aqui tira alguém da lista sem volta fácil. Só contam como substring frases
 * inequívocas de opt-out; a palavra solta só conta quando é a MENSAGEM
 * INTEIRA — convenção padrão de disparo em massa ("responda PARAR pra sair").
 */

const FRASES_OPT_OUT = [
  "pare de mandar",
  "pare de enviar",
  "pare de me mandar",
  "parem de mandar",
  "parem de enviar",
  "parar de mandar",
  "parar de enviar",
  "parar de me mandar",
  "nao quero mais receber",
  "nao mandem mais mensagem",
  "nao me mande mais mensagem",
  "nao envie mais mensagem",
  "remover meu contato",
  "remover meu numero",
  "me remova",
  "me tira dessa lista",
  "tira meu numero",
  "tirar da lista",
  "sair da lista",
  "descadastrar",
  "cancelar inscricao",
];

const PALAVRAS_EXATAS_OPT_OUT = ["parar", "pare", "sair", "stop", "cancelar", "remover", "descadastrar"];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function detectarPedidoOptOut(mensagem: string): boolean {
  const normalizado = normalizar(mensagem);
  if (!normalizado) return false;
  if (PALAVRAS_EXATAS_OPT_OUT.includes(normalizado)) return true;
  return FRASES_OPT_OUT.some((f) => normalizado.includes(f));
}

export const MENSAGEM_CONFIRMACAO_OPT_OUT =
  "Combinado! Você não vai mais receber mensagens de campanha ou lembrete por aqui. Se precisar de algo, pode escrever a qualquer momento 😊";

export type ResultadoOptOut = { ok: boolean; error?: string };

export async function aplicarOptOut(clinicaId: string, pacienteId: string, origem: string): Promise<ResultadoOptOut> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "backend_unavailable" };

  const agora = new Date().toISOString();
  const { error } = await supabase
    .from("pacientes")
    .update({ opt_out_em: agora, opt_out_origem: origem, updated_at: agora })
    .eq("id", pacienteId)
    .eq("clinica_id", clinicaId);

  if (error) {
    console.error("[opt-out] aplicar_failed", JSON.stringify({ pacienteId, code: error.code ?? null }));
    return { ok: false, error: "persist_failed" };
  }
  return { ok: true };
}
