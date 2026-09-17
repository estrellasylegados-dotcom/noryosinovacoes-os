"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NoCardBase } from "@/components/fluxos/nos/NoCardBase";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import type { NoPersistirRespostaPesquisa } from "@/lib/fluxo-tipos";

function IconePersistirResposta() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </svg>
  );
}

/** Fase 3 — único responsável por gravar pesquisa_respostas (nunca o mesmo nó que cria a pesquisa). */
export function NoPersistirRespostaPesquisaCard({ data }: NodeProps<Node<NoCanvasData>>) {
  const no = data.no as NoPersistirRespostaPesquisa;
  return (
    <>
      <Handle type="target" position={Position.Left} />
      <NoCardBase titulo="Persistir resposta" icone={<IconePersistirResposta />} problema={data.problema} emExecucao={data.emExecucao}>
        <p className="mt-1 text-xs text-neutral-500">
          pesquisa: <span className="font-medium text-neutral-700">{no.variavelPesquisaId || "(sem variável)"}</span>
        </p>
        <p className="text-xs text-neutral-500">
          nota/valor: <span className="font-medium text-neutral-700">{no.variavelValor || "(sem variável)"}</span>
        </p>
      </NoCardBase>
      <Handle type="source" position={Position.Right} id="default" />
    </>
  );
}
