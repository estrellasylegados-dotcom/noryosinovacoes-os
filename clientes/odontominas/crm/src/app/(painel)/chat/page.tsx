import { getClinicaId } from "@/lib/clinica";
import { listarConversasChat } from "@/lib/chat";
import { listarEtiquetas } from "@/lib/etiquetas";
import { listarAtendentes } from "@/lib/atendentes";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { ChatAoVivo } from "@/components/chat/ChatAoVivo";

export const dynamic = "force-dynamic";

/**
 * Chat ao Vivo (2026-09-15, a pedido do Rafael, inspirado na RoiZap): inbox
 * de verdade — lista + thread + resposta pelo painel — ao lado do Painel de
 * Atendimento (que continua sendo a visão de funil/funnel). A página só
 * busca o estado inicial; toda interação depois (trocar aba, abrir
 * conversa, mandar mensagem) roda no cliente contra as rotas /api/chat/*,
 * sem recarregar a página inteira.
 */
export default async function ChatAoVivoPage() {
  const [sessao, clinicaId] = await Promise.all([getSessaoAtual(), getClinicaId()]);

  if (!clinicaId) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">
          Não consegui conectar ao banco do CRM. Confira as variáveis de ambiente do Supabase.
        </p>
      </main>
    );
  }

  const [conversas, etiquetas, atendentes] = await Promise.all([
    listarConversasChat(clinicaId),
    listarEtiquetas(clinicaId),
    listarAtendentes(clinicaId),
  ]);

  return (
    <ChatAoVivo
      conversasIniciais={conversas}
      etiquetasIniciais={etiquetas}
      atendentes={atendentes}
      atendenteAtualId={sessao?.atendenteId ?? null}
    />
  );
}
