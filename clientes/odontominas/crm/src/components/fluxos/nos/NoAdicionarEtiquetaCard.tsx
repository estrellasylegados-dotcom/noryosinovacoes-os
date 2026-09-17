"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoAdicionarEtiqueta } from "@/lib/fluxo-tipos";

function IconeEtiqueta() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M20.59 13.41 12 22l-9-9V4h9z" />
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function NoAdicionarEtiquetaCard({ data }: NodeProps<Node<NoCanvasData>>) {
  const no = data.no as NoAdicionarEtiqueta;
  const nome = no.etiquetaId ? (data.etiquetaNomePorId?.get(no.etiquetaId) ?? no.etiquetaId) : null;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Adicionar etiqueta" icone={<IconeEtiqueta />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 text-sm text-neutral-800">{nome ?? "(selecione uma etiqueta)"}</p>
      </NoCardBase>
      <Handle type="source" position={Position.Right} id="default" />
    </>
  );
}
