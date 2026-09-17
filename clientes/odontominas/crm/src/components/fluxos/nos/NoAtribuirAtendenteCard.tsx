"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoAtribuirAtendente } from "@/lib/fluxo-tipos";

function IconeAtendente() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

export function NoAtribuirAtendenteCard({ data }: NodeProps<Node<NoCanvasData>>) {
  const no = data.no as NoAtribuirAtendente;
  const nome = no.atendenteId ? (data.atendenteNomePorId?.get(no.atendenteId) ?? no.atendenteId) : null;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Atribuir atendente" icone={<IconeAtendente />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 text-sm text-neutral-800">{nome ?? "(sem atendente — desatribui)"}</p>
      </NoCardBase>
      <Handle type="source" position={Position.Right} id="default" />
    </>
  );
}
