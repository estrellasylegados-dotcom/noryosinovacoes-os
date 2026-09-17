"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoCapturarResposta } from "@/lib/fluxo-tipos";

function IconeCapturarResposta() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

/** Mesma família visual de NoMenuCard — entrada aberta/validada em vez de escolha fechada (Fase 3, motor central de automação). */
export function NoCapturarRespostaCard({ data }: NodeProps<Node<NoCanvasData>>) {
  const no = data.no as NoCapturarResposta;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Capturar resposta" icone={<IconeCapturarResposta />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-neutral-800">{no.texto || "(sem pergunta)"}</p>
        <div className="mt-2 space-y-1">
          <div className="relative rounded border border-neutral-100 bg-neutral-50 px-2 py-1 pr-4 text-xs text-neutral-700">
            <span className="font-medium">{no.variavel || "(sem variável)"}</span> — {no.tipoValor}
            <Handle type="source" position={Position.Right} id="default" style={{ top: "50%" }} />
          </div>
          {no.proximoTimeout && (
            <div className="relative rounded border border-dashed border-neutral-200 px-2 py-1 pr-4 text-xs text-neutral-400">
              timeout ({no.timeoutSegundos ?? "?"}s)
              <Handle type="source" position={Position.Right} id="timeout" style={{ top: "50%", background: "#a3a3a3" }} />
            </div>
          )}
        </div>
      </NoCardBase>
    </>
  );
}
