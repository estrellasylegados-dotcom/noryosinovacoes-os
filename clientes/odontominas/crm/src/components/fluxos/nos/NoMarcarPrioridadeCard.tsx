"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoMarcarPrioridade } from "@/lib/fluxo-tipos";
import { PRIORIDADE_CONFIG } from "@/lib/prioridade";

function IconePrioridade() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2v14M6 8l6-6 6 6" />
      <path d="M6 22h12" />
    </svg>
  );
}

export function NoMarcarPrioridadeCard({ data }: NodeProps<Node<NoCanvasData>>) {
  const no = data.no as NoMarcarPrioridade;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Marcar prioridade" icone={<IconePrioridade />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 text-sm text-neutral-800">{PRIORIDADE_CONFIG[no.prioridade].label}</p>
      </NoCardBase>
      <Handle type="source" position={Position.Right} id="default" />
    </>
  );
}
