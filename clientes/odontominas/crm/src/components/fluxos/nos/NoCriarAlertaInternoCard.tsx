"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoCriarAlertaInterno } from "@/lib/fluxo-tipos";

function IconeAlerta() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function NoCriarAlertaInternoCard({ data }: NodeProps<Node<NoCanvasData>>) {
  const no = data.no as NoCriarAlertaInterno;
  const qtdNumeros = no.numeros.split(",").map((n) => n.trim()).filter(Boolean).length;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Criar alerta interno" icone={<IconeAlerta />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 line-clamp-2 text-sm text-neutral-800">{no.mensagem || "(sem texto)"}</p>
        <p className="mt-1 text-xs text-neutral-400">
          {qtdNumeros === 0 ? "nenhum número configurado" : `${qtdNumeros} número${qtdNumeros > 1 ? "s" : ""}`}
        </p>
      </NoCardBase>
      <Handle type="source" position={Position.Right} id="default" />
    </>
  );
}
