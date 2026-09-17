"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoFinalizar } from "@/lib/fluxo-tipos";

function IconeFim() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}

export function NoFinalizarCard({ data }: NodeProps<Node<NoCanvasData>>) {
  const no = data.no as NoFinalizar;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Finalizar" icone={<IconeFim />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 text-sm text-neutral-800">{no.motivo ?? "encerra a execução"}</p>
      </NoCardBase>
    </>
  );
}
