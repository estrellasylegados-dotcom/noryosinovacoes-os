"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoIniciarAgenteIA } from "@/lib/fluxo-tipos";

function IconeIA() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="4" y="7" width="16" height="12" rx="2" />
      <path d="M12 7V3M9 12h.01M15 12h.01" />
    </svg>
  );
}

/** Terminal — sem Handle de saída, entrega a conversa pro agente escolhido. */
export function NoIniciarAgenteIACard({ data }: NodeProps<Node<NoCanvasData>>) {
  const no = data.no as NoIniciarAgenteIA;
  const nome = no.agenteId ? (data.agenteNomePorId?.get(no.agenteId) ?? no.agenteId) : null;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Iniciar agente de IA" icone={<IconeIA />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 text-sm text-neutral-800">{nome ?? "(selecione um agente)"}</p>
      </NoCardBase>
    </>
  );
}
