"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoCriarPesquisa } from "@/lib/fluxo-tipos";

const LABEL_TIPO_PESQUISA: Record<NoCriarPesquisa["tipoPesquisa"], string> = {
  nps: "NPS",
  satisfacao: "Satisfação",
  avaliacao_google: "Avaliação Google",
};

function IconeCriarPesquisa() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 17V9m4 8V5m4 12v-4M5 21h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" />
    </svg>
  );
}

/** Fase 3 — infra genérica de pesquisas/solicitações (NPS, satisfação, avaliação Google). Nasce "enviada"; nunca cria resposta sozinho. */
export function NoCriarPesquisaCard({ data }: NodeProps<Node<NoCanvasData>>) {
  const no = data.no as NoCriarPesquisa;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Criar pesquisa" icone={<IconeCriarPesquisa />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 text-sm font-medium text-neutral-800">{LABEL_TIPO_PESQUISA[no.tipoPesquisa]}</p>
        <p className="mt-1 text-xs text-neutral-500">salva em: {no.variavelDestino || "(sem variável)"}</p>
      </NoCardBase>
      <Handle type="source" position={Position.Right} id="default" />
    </>
  );
}
