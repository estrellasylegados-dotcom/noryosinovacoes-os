"use client";

import type { DragEvent } from "react";
import { MIME_BLOCO_FLUXO } from "@/components/fluxos/FluxoCanvas";
import type { NoFluxo } from "@/lib/fluxo-tipos";

const BLOCOS_BASICOS: { tipo: NoFluxo["tipo"]; label: string; descricao: string }[] = [
  { tipo: "mensagem", label: "Mensagem", descricao: "Envia um texto" },
  { tipo: "espera", label: "Espera", descricao: "Aguarda um tempo" },
  { tipo: "menu", label: "Menu", descricao: "Pergunta e espera resposta (escolha fechada)" },
  { tipo: "capturar_resposta", label: "Capturar resposta", descricao: "Pergunta e valida uma resposta aberta (texto ou número)" },
  { tipo: "condicao", label: "Se / Senão", descricao: "Ramifica por uma variável" },
  { tipo: "finalizar", label: "Finalizar", descricao: "Encerra a execução" },
];

/** Fase 3 — infra genérica de pesquisas/solicitações (NPS, satisfação, avaliação Google). Criação e resposta são sempre blocos separados. */
const BLOCOS_PESQUISAS: { tipo: NoFluxo["tipo"]; label: string; descricao: string }[] = [
  { tipo: "criar_pesquisa", label: "Criar pesquisa", descricao: "Registra uma pesquisa/solicitação (NPS, satisfação ou avaliação Google)" },
  { tipo: "persistir_resposta_pesquisa", label: "Salvar resposta da pesquisa", descricao: "Grava a resposta capturada numa pesquisa já criada" },
];

/** Não depende de nenhuma capability externa — só escreve em tabelas que o CRM já usa em produção (etiquetas, funil/status, prioridade, atendente). */
const BLOCOS_ACAO_CRM: { tipo: NoFluxo["tipo"]; label: string; descricao: string }[] = [
  { tipo: "adicionar_etiqueta", label: "Adicionar etiqueta", descricao: "Marca a conversa com uma etiqueta" },
  { tipo: "remover_etiqueta", label: "Remover etiqueta", descricao: "Tira uma etiqueta da conversa" },
  { tipo: "mudar_status", label: "Mover no funil", descricao: "Muda o status da conversa" },
  { tipo: "marcar_prioridade", label: "Marcar prioridade", descricao: "Define a prioridade da conversa" },
  { tipo: "atribuir_atendente", label: "Atribuir atendente", descricao: "Define quem cuida da conversa" },
];

/** Só os 4 blocos que cabem com segurança na arquitetura atual (ver decisão registrada quando esta fatia entrou) — "Enviar contexto pra agente"/"Retomar fluxo após IA"/"Encerrar IA" ficam de fora até existir um protocolo de handoff `agentes.ts` ↔ motor do fluxo. */
const BLOCOS_HUMANO: { tipo: NoFluxo["tipo"]; label: string; descricao: string }[] = [
  { tipo: "transferir_humano", label: "Transferir p/ humano", descricao: "Encerra a automação, devolve pra equipe" },
  { tipo: "criar_alerta_interno", label: "Criar alerta interno", descricao: "Manda um WhatsApp pra equipe" },
  { tipo: "pausar_automacao", label: "Pausar automação", descricao: "Impede o agente de retomar sozinho" },
];

const BLOCOS_IA: { tipo: NoFluxo["tipo"]; label: string; descricao: string }[] = [
  { tipo: "iniciar_agente_ia", label: "Iniciar agente de IA", descricao: "Entrega a conversa pro agente escolhido" },
];

/** Categoria Odonto da visão original — depende do ControleODONTO, que ainda não tem capability validada (ver src/lib/controle-odonto/capabilities.ts). Aparece, mas não arrasta: mesmo padrão "Indisponível" já usado na tela de Integrações. */
const BLOCOS_ODONTO = [
  "Escolher especialidade/unidade/profissional",
  "Consultar agenda",
  "Selecionar horário",
  "Solicitar/confirmar agendamento",
  "Solicitar reagendamento/cancelamento",
  "Paciente faltou",
  "Retorno pendente",
];

function SecaoBlocos({
  titulo,
  blocos,
  onDragStart,
}: {
  titulo: string;
  blocos: { tipo: NoFluxo["tipo"]; label: string; descricao: string }[];
  onDragStart: (event: DragEvent<HTMLDivElement>, tipo: NoFluxo["tipo"]) => void;
}) {
  return (
    <>
      <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 first:mt-0">{titulo}</p>
      <div className="space-y-2">
        {blocos.map((bloco) => (
          <div
            key={bloco.tipo}
            draggable
            onDragStart={(e) => onDragStart(e, bloco.tipo)}
            className="cursor-grab rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-sm hover:border-teal-400 hover:bg-teal-50 active:cursor-grabbing"
          >
            <p className="font-medium text-neutral-800">{bloco.label}</p>
            <p className="text-xs text-neutral-500">{bloco.descricao}</p>
          </div>
        ))}
      </div>
    </>
  );
}

export function FluxoPaletaBlocos({ controleOdontoConfigurado }: { controleOdontoConfigurado: boolean }) {
  function handleDragStart(event: DragEvent<HTMLDivElement>, tipo: NoFluxo["tipo"]) {
    event.dataTransfer.setData(MIME_BLOCO_FLUXO, tipo);
    event.dataTransfer.effectAllowed = "move";
  }

  const mensagemOdonto = controleOdontoConfigurado
    ? "Indisponível — integração configurada, mas a leitura de agenda ainda não foi validada."
    : "Indisponível — integração ControleODONTO não configurada.";

  return (
    <aside className="w-56 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white p-3">
      <SecaoBlocos titulo="Blocos" blocos={BLOCOS_BASICOS} onDragStart={handleDragStart} />
      <SecaoBlocos titulo="Ações CRM" blocos={BLOCOS_ACAO_CRM} onDragStart={handleDragStart} />
      <SecaoBlocos titulo="Humano" blocos={BLOCOS_HUMANO} onDragStart={handleDragStart} />
      <SecaoBlocos titulo="IA" blocos={BLOCOS_IA} onDragStart={handleDragStart} />
      <SecaoBlocos titulo="Pesquisas" blocos={BLOCOS_PESQUISAS} onDragStart={handleDragStart} />

      <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Odonto</p>
      <div className="space-y-2">
        {BLOCOS_ODONTO.map((label) => (
          <div
            key={label}
            title={mensagemOdonto}
            className="cursor-not-allowed rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-2 text-sm opacity-60"
          >
            <p className="font-medium text-neutral-500">{label}</p>
            <p className="text-xs text-neutral-400">{mensagemOdonto}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
