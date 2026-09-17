"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoMudarStatus } from "@/lib/fluxo-tipos";
import { STATUS_CONFIG } from "@/lib/status";

function IconeFunil() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 4h16l-6 8v6l-4 2v-8z" />
    </svg>
  );
}

export function NoMudarStatusCard({ data }: NodeProps<Node<NoCanvasData>>) {
  const no = data.no as NoMudarStatus;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Mover no funil" icone={<IconeFunil />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 text-sm text-neutral-800">{STATUS_CONFIG[no.status].label}</p>
      </NoCardBase>
      <Handle type="source" position={Position.Right} id="default" />
    </>
  );
}
