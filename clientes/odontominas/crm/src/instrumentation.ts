/**
 * Ponto padrão do Next.js pra rodar código uma vez quando o processo sobe —
 * usado aqui só pra ligar o poll do buffer de mensagens dos Agentes de IA
 * (src/lib/agentes-buffer.ts, Fase 2B).
 *
 * Só em produção (`next start` — Railway, ou um teste local com
 * `npm run build && npm run start`), nunca em `npm run dev`: decisão do
 * Rafael, evita o risco (raro, mas real) de 2 respostas saírem se ele testar
 * localmente enquanto uma conversa real tem buffer pendente em produção —
 * os dois processos apontam pro mesmo Supabase/Evolution via `.env.local`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { iniciarPollBuffer } = await import("@/lib/agentes-buffer");
    iniciarPollBuffer();
  }
}
