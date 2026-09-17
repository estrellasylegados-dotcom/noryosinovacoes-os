"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";

function IconePausa() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

export function NoPausarAutomacaoCard({ data }: NodeProps<Node<NoCanvasData>>) {
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Pausar automação" icone={<IconePausa />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 text-sm text-neutral-800">impede o agente de IA de retomar sozinho</p>
      </NoCardBase>
      <Handle type="source" position={Position.Right} id="default" />
    </>
  );
}
