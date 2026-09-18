/**
 * Sanitização de mensagem de erro pra log/diagnóstico: corta o que parece
 * segredo (chaves do Resend, JWT/Bearer, hex/base64 longos, pares chave=valor
 * sensíveis) e o valor literal de qualquer variável de ambiente sensível.
 * Nunca é usada pra decidir nada — só pra o texto poder ser colado num chat.
 */
const ENVS_SENSIVEIS = ["RESEND_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SESSAO_SECRET", "CRON_SECRET", "DATABASE_URL"];

export function sanitizarMensagemErro(mensagem: unknown, limite = 300): string {
  let texto = typeof mensagem === "string" ? mensagem : mensagem instanceof Error ? mensagem.message : String(mensagem ?? "");
  for (const nome of ENVS_SENSIVEIS) {
    const valor = process.env[nome];
    if (valor && valor.length >= 8) texto = texto.split(valor).join("[redigido]");
  }
  texto = texto
    .replace(/re_[A-Za-z0-9_]{8,}/g, "[redigido]")
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[redigido]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redigido]")
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, "[redigido]")
    .replace(/\b(api[_-]?key|token|secret|password|senha|apikey|authorization)\s*[=:]\s*\S+/gi, "$1=[redigido]")
    .replace(/\/\/[^/\s:@]+:[^/\s@]+@/g, "//[redigido]@");
  return texto.length > limite ? `${texto.slice(0, limite)}…` : texto;
}
