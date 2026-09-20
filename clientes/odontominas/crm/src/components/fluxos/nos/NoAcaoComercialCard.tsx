"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoAcaoComercial } from "@/lib/fluxo-tipos";
export function NoAcaoComercialCard({data}:NodeProps<Node<NoCanvasData>>) {
  const no=data.no as NoAcaoComercial;
  const rotulos={mover_oportunidade:'Mover oportunidade',responsavel:'Alterar responsável',interesse:'Atualizar interesse',nota:'Nota interna',alerta:'Criar alerta na Central'};
  return <><Handle type="target" position={Position.Left}/><NoCardBase titulo={rotulos[no.acao]} icone={<span>↗</span>} problema={data.problema} emExecucao={data.emExecucao}>
    <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{['nota','alerta','interesse'].includes(no.acao)?no.valor:'Na oportunidade desta automação'}</p>
  </NoCardBase><Handle type="source" position={Position.Right} id="default"/></>;
}
