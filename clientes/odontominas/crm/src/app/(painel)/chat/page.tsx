import { buscarClinicaAtual, getClinicaId } from "@/lib/clinica";
import { listarConversasChat } from "@/lib/chat";
import { listarEtiquetas } from "@/lib/etiquetas";
import { listarAtendentes } from "@/lib/atendentes";
import { listarAgentes } from "@/lib/agentes";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { atorDaSessao } from "@/lib/autorizacao";
import { listarCanais } from "@/lib/canais";
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

  const [conversas, etiquetas, atendentes, agentes, clinicaAtual, canais] = await Promise.all([
    listarConversasChat(clinicaId, sessao ? atorDaSessao(sessao) : null),
    listarEtiquetas(clinicaId),
    listarAtendentes(clinicaId),
    listarAgentes(clinicaId),
    buscarClinicaAtual(),
    listarCanais(clinicaId),
  ]);

  // Só oferece "Retomar IA" quando a etiqueta que a conversa já tem de fato liga a algum agente ativo.
  const etiquetasComAgente = agentes
    .filter((a) => a.ativo && a.etiquetaGatilhoId)
    .map((a) => a.etiquetaGatilhoId as string);

  return (
    <ChatAoVivo
      conversasIniciais={conversas}
      etiquetasIniciais={etiquetas}
      etiquetasComAgente={etiquetasComAgente}
      atendentes={atendentes}
      atendenteAtualId={sessao?.atendenteId ?? null}
      clinicaNome={clinicaAtual?.nome ?? "Clínica"}
      canais={canais.map((c) => ({ id: c.id, nome: c.nome, ativo: c.ativo }))}
      permissoes={sessao ? Array.from(sessao.permissoes) : []}
    />
  );
}
