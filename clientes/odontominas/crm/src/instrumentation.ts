/**
 * Ponto padrão do Next.js pra rodar código uma vez quando o processo sobe —
 * usado aqui pra ligar o poll do buffer de mensagens dos Agentes de IA
 * (src/lib/agentes-buffer.ts, Fase 2B) e o worker de envio de campanhas de
 * Disparos (src/lib/disparos-worker.ts, Fase B).
 *
 * Só em produção (`next start` — Railway, ou um teste local com
 * `npm run build && npm run start`), nunca em `npm run dev`: decisão do
 * Rafael, evita o risco (raro, mas real) de 2 processos disputando o mesmo
 * Supabase/Evolution se ele testar localmente enquanto a produção também
 * está de pé — os dois apontam pro mesmo backend via `.env.local`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { iniciarPollBuffer } = await import("@/lib/agentes-buffer");
    iniciarPollBuffer();

    const { iniciarWorkerDisparos } = await import("@/lib/disparos-worker");
    iniciarWorkerDisparos();
  }
}
