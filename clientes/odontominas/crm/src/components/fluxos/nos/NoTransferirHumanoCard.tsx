"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoTransferirHumano } from "@/lib/fluxo-tipos";

function IconeHumano() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      <path d="M9 21l2 2 4-5" strokeWidth={2.5} />
    </svg>
  );
}

/** Terminal — sem Handle de saída, mesmo desenho de NoFinalizarCard. */
export function NoTransferirHumanoCard({ data }: NodeProps<Node<NoCanvasData>>) {
  const no = data.no as NoTransferirHumano;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Transferir p/ humano" icone={<IconeHumano />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 text-sm text-neutral-800">{no.motivo ?? "encerra a automação, devolve pra equipe"}</p>
      </NoCardBase>
    </>
  );
}
