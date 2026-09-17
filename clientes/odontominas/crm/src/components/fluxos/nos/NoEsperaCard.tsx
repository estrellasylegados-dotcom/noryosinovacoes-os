"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoEspera } from "@/lib/fluxo-tipos";

function IconeEspera() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function formatarDuracao(segundos: number): string {
  if (segundos < 60) return `${segundos}s`;
  if (segundos < 3600) return `${Math.round(segundos / 60)}min`;
  if (segundos < 86400) return `${Math.round(segundos / 3600)}h`;
  return `${Math.round(segundos / 86400)}d`;
}

export function NoEsperaCard({ data }: NodeProps<Node<NoCanvasData>>) {
  const no = data.no as NoEspera;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Espera" icone={<IconeEspera />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 text-sm font-medium text-neutral-800">Aguarda {formatarDuracao(no.duracaoSegundos)}</p>
      </NoCardBase>
      <Handle type="source" position={Position.Right} id="default" />
    </>
  );
}
