"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoMensagem } from "@/lib/fluxo-tipos";

function IconeMensagem() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function NoMensagemCard({ data }: NodeProps<Node<NoCanvasData>>) {
  const no = data.no as NoMensagem;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Mensagem" icone={<IconeMensagem />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-neutral-800">{no.texto || "(sem texto)"}</p>
      </NoCardBase>
      <Handle type="source" position={Position.Right} id="default" />
    </>
  );
}
