"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoMenu } from "@/lib/fluxo-tipos";

function IconeMenu() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function NoMenuCard({ data }: NodeProps<Node<NoCanvasData>>) {
  const no = data.no as NoMenu;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Menu" icone={<IconeMenu />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-neutral-800">{no.texto || "(sem texto)"}</p>
        <div className="mt-2 space-y-1">
          {no.opcoes.map((opcao, indice) => (
            <div key={indice} className="relative rounded border border-neutral-100 bg-neutral-50 px-2 py-1 pr-4 text-xs text-neutral-700">
              <span className="font-medium">{opcao.valor}</span> — {opcao.rotulos[0] ?? ""}
              <Handle type="source" position={Position.Right} id={`opcao:${indice}`} style={{ top: "50%" }} />
            </div>
          ))}
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
