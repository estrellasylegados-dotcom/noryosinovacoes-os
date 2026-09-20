"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoCondicao } from "@/lib/fluxo-tipos";

function IconeCondicao() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 3v12a3 3 0 0 0 3 3h5M14 21l4-4-4-4" />
    </svg>
  );
}

const ROTULO_OPERADOR: Record<NoCondicao["operador"], string> = {
  maior: "maior que", menor: "menor que", maior_igual: "pelo menos", menor_igual: "no máximo", contem_item: "inclui",
  igual: "igual a",
  diferente: "diferente de",
  contem: "contém",
  existe: "existe",
  nao_existe: "não existe",
};

export function NoCondicaoCard({ data }: NodeProps<Node<NoCanvasData>>) {
  const no = data.no as NoCondicao;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Se / Senão" icone={<IconeCondicao />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 text-sm text-neutral-800">
          {`{${no.variavel || "variável"}}`} {ROTULO_OPERADOR[no.operador]} {no.valor ? `"${no.valor}"` : ""}
        </p>
        <div className="mt-2 space-y-1">
          <div className="relative rounded border border-emerald-100 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
            Sim
            <Handle type="source" position={Position.Right} id="verdadeiro" style={{ top: "50%", background: "#059669" }} />
          </div>
          <div className="relative rounded border border-red-100 bg-red-50 px-2 py-1 text-xs text-red-700">
            Não
            <Handle type="source" position={Position.Right} id="falso" style={{ top: "50%", background: "#dc2626" }} />
          </div>
        </div>
      </NoCardBase>
    </>
  );
}
