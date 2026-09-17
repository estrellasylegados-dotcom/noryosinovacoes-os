"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";

function IconeInicio() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function NoInicioCard({ data }: NodeProps<Node<NoCanvasData>>) {
  return (
    <>
      <NoCardBase titulo="Início" icone={<IconeInicio />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 text-xs text-neutral-500">Disparado pelo gatilho configurado na aba &quot;Gatilho&quot;.</p>
      </NoCardBase>
      <Handle type="source" position={Position.Right} id="default" />
    </>
  );
}
