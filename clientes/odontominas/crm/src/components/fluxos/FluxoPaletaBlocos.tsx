"use client";

import type { DragEvent } from "react";
import { MIME_BLOCO_FLUXO } from "@/components/fluxos/FluxoCanvas";
import type { NoFluxo } from "@/lib/fluxo-tipos";

const BLOCOS_BASICOS: { tipo: NoFluxo["tipo"]; label: string; descricao: string }[] = [
  { tipo: "mensagem", label: "Mensagem", descricao: "Envia um texto" },
  { tipo: "espera", label: "Espera", descricao: "Aguarda um tempo" },
  { tipo: "menu", label: "Menu", descricao: "Pergunta e espera resposta" },
  { tipo: "condicao", label: "Se / Senão", descricao: "Ramifica por uma variável" },
  { tipo: "finalizar", label: "Finalizar", descricao: "Encerra a execução" },
];

/** Não depende de nenhuma capability externa — só escreve em tabelas que o CRM já usa em produção (etiquetas, funil/status, prioridade, atendente). */
const BLOCOS_ACAO_CRM: { tipo: NoFluxo["tipo"]; label: string; descricao: string }[] = [
  { tipo: "adicionar_etiqueta", label: "Adicionar etiqueta", descricao: "Marca a conversa com uma etiqueta" },
  { tipo: "remover_etiqueta", label: "Remover etiqueta", descricao: "Tira uma etiqueta da conversa" },
  { tipo: "mudar_status", label: "Mover no funil", descricao: "Muda o status da conversa" },
  { tipo: "marcar_prioridade", label: "Marcar prioridade", descricao: "Define a prioridade da conversa" },
  { tipo: "atribuir_atendente", label: "Atribuir atendente", descricao: "Define quem cuida da conversa" },
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
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Blocos</p>
      <div className="space-y-2">
        {BLOCOS_BASICOS.map((bloco) => (
          <div
            key={bloco.tipo}
            draggable
            onDragStart={(e) => handleDragStart(e, bloco.tipo)}
            className="cursor-grab rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-sm hover:border-teal-400 hover:bg-teal-50 active:cursor-grabbing"
          >
            <p className="font-medium text-neutral-800">{bloco.label}</p>
            <p className="text-xs text-neutral-500">{bloco.descricao}</p>
          </div>
        ))}
      </div>

      <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Ações CRM</p>
      <div className="space-y-2">
        {BLOCOS_ACAO_CRM.map((bloco) => (
          <div
            key={bloco.tipo}
            draggable
            onDragStart={(e) => handleDragStart(e, bloco.tipo)}
            className="cursor-grab rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-sm hover:border-teal-400 hover:bg-teal-50 active:cursor-grabbing"
          >
            <p className="font-medium text-neutral-800">{bloco.label}</p>
            <p className="text-xs text-neutral-500">{bloco.descricao}</p>
          </div>
        ))}
      </div>

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
