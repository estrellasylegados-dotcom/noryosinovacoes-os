"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, type DragEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import { NoAdicionarEtiquetaCard } from "@/components/fluxos/nos/NoAdicionarEtiquetaCard";
import { NoAtribuirAtendenteCard } from "@/components/fluxos/nos/NoAtribuirAtendenteCard";
import { NoCondicaoCard } from "@/components/fluxos/nos/NoCondicaoCard";
import { NoCriarAlertaInternoCard } from "@/components/fluxos/nos/NoCriarAlertaInternoCard";
import { NoEsperaCard } from "@/components/fluxos/nos/NoEsperaCard";
import { NoFinalizarCard } from "@/components/fluxos/nos/NoFinalizarCard";
import { NoIniciarAgenteIACard } from "@/components/fluxos/nos/NoIniciarAgenteIACard";
import { NoInicioCard } from "@/components/fluxos/nos/NoInicioCard";
import { NoMarcarPrioridadeCard } from "@/components/fluxos/nos/NoMarcarPrioridadeCard";
import { NoMenuCard } from "@/components/fluxos/nos/NoMenuCard";
import { NoMensagemCard } from "@/components/fluxos/nos/NoMensagemCard";
import { NoMudarStatusCard } from "@/components/fluxos/nos/NoMudarStatusCard";
import { NoPausarAutomacaoCard } from "@/components/fluxos/nos/NoPausarAutomacaoCard";
import { NoRemoverEtiquetaCard } from "@/components/fluxos/nos/NoRemoverEtiquetaCard";
import { NoTransferirHumanoCard } from "@/components/fluxos/nos/NoTransferirHumanoCard";
import type { NoCanvasData } from "@/components/fluxos/nos/tipos";
import { derivarArestasXyflow, podeDeletarAresta } from "@/lib/fluxo-editor-grafo";
import type { PosicaoNo } from "@/lib/fluxo-editor-layout";
import type { NoFluxo } from "@/lib/fluxo-tipos";
import type { Etiqueta } from "@/lib/etiquetas";
import type { Atendente } from "@/lib/atendentes";
import type { AgenteIA } from "@/lib/agentes";

const TIPOS_NO: NodeTypes = {
  inicio: NoInicioCard,
  mensagem: NoMensagemCard,
  espera: NoEsperaCard,
  menu: NoMenuCard,
  condicao: NoCondicaoCard,
  finalizar: NoFinalizarCard,
  adicionar_etiqueta: NoAdicionarEtiquetaCard,
  remover_etiqueta: NoRemoverEtiquetaCard,
  mudar_status: NoMudarStatusCard,
  marcar_prioridade: NoMarcarPrioridadeCard,
  atribuir_atendente: NoAtribuirAtendenteCard,
  transferir_humano: NoTransferirHumanoCard,
  criar_alerta_interno: NoCriarAlertaInternoCard,
  pausar_automacao: NoPausarAutomacaoCard,
  iniciar_agente_ia: NoIniciarAgenteIACard,
};

/** Formato do arrasto vindo da paleta (`FluxoPaletaBlocos`) — nome de tipo MIME próprio, não colide com nada externo. */
export const MIME_BLOCO_FLUXO = "application/x-fluxo-bloco";

export type FluxoCanvasProps = {
  nodes: NoFluxo[];
  posicoes: Record<string, PosicaoNo>;
  selecionadoId: string | null;
  problemasPorNo: Map<string, "erro" | "aviso">;
  noEmExecucaoId?: string | null;
  etiquetas: Etiqueta[];
  atendentes: Atendente[];
  agentes: AgenteIA[];
  onSelecionar: (id: string | null) => void;
  onMoverNo: (id: string, posicao: PosicaoNo) => void;
  onConectar: (source: string, sourceHandle: string, target: string) => void;
  onDeletarAresta: (noId: string, sourceHandle: string) => void;
  onDeletarNo: (id: string) => void;
  onSoltarBloco: (tipo: NoFluxo["tipo"], posicao: PosicaoNo) => void;
};

function FluxoCanvasInterno(props: FluxoCanvasProps) {
  const {
    nodes,
    posicoes,
    selecionadoId,
    problemasPorNo,
    noEmExecucaoId,
    etiquetas,
    atendentes,
    agentes,
    onSelecionar,
    onMoverNo,
    onConectar,
    onDeletarAresta,
    onDeletarNo,
    onSoltarBloco,
  } = props;
  const { screenToFlowPosition } = useReactFlow();
  const [xyNodes, setXyNodes] = useNodesState<Node<NoCanvasData>>([]);
  const etiquetaNomePorId = useMemo(() => new Map(etiquetas.map((e) => [e.id, e.nome])), [etiquetas]);
  const atendenteNomePorId = useMemo(() => new Map(atendentes.map((a) => [a.id, a.nome])), [atendentes]);
  const agenteNomePorId = useMemo(() => new Map(agentes.map((a) => [a.id, a.nome])), [agentes]);

  // Reposta a lista de nós do xyflow sempre que a estrutura/seleção/estado
  // de execução muda. Posição vem sempre de `posicoes` (nunca de um estado
  // local próprio) — é o que faz undo/redo e "auto organizar" refletirem no
  // canvas; durante um drag em andamento nenhuma dessas deps muda, então o
  // handler de posição ao vivo (`handleNodesChange`) não é sobrescrito.
  useEffect(() => {
    setXyNodes(
      nodes.map((no) => ({
        id: no.id,
        type: no.tipo,
        position: posicoes[no.id] ?? { x: 0, y: 0 },
        data: { no, problema: problemasPorNo.get(no.id), emExecucao: no.id === noEmExecucaoId, etiquetaNomePorId, atendenteNomePorId, agenteNomePorId },
        selected: no.id === selecionadoId,
        deletable: no.tipo !== "inicio",
      }))
    );
  }, [nodes, posicoes, problemasPorNo, noEmExecucaoId, selecionadoId, etiquetaNomePorId, atendenteNomePorId, agenteNomePorId, setXyNodes]);

  const arestas = useMemo<Edge[]>(
    () => derivarArestasXyflow(nodes).map((a) => ({ id: a.id, source: a.source, sourceHandle: a.sourceHandle, target: a.target, type: "smoothstep" })),
    [nodes]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<NoCanvasData>>[]) => {
      setXyNodes((atuais) => applyNodeChanges<Node<NoCanvasData>>(changes, atuais));
      for (const change of changes) {
        if (change.type === "remove") onDeletarNo(change.id);
      }
    },
    [setXyNodes, onDeletarNo]
  );

  const handleNodeDragStop = useCallback((_event: unknown, node: Node) => onMoverNo(node.id, node.position), [onMoverNo]);

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !connection.sourceHandle) return;
      onConectar(connection.source, connection.sourceHandle, connection.target);
    },
    [onConectar]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type !== "remove") continue;
        const aresta = arestas.find((a) => a.id === change.id);
        if (!aresta || !aresta.sourceHandle) continue;
        const no = nodes.find((n) => n.id === aresta.source);
        // Conector obrigatório: ignora — a aresta é derivada de novo no
        // próximo render a partir de `nodes`, então ela só "reaparece".
        if (no && podeDeletarAresta(no, aresta.sourceHandle)) onDeletarAresta(aresta.source, aresta.sourceHandle);
      }
    },
    [arestas, nodes, onDeletarAresta]
  );

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const tipo = event.dataTransfer.getData(MIME_BLOCO_FLUXO) as NoFluxo["tipo"] | "";
      if (!tipo) return;
      const posicao = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      onSoltarBloco(tipo, posicao);
    },
    [screenToFlowPosition, onSoltarBloco]
  );

  return (
    <div className="h-full w-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      <ReactFlow
        nodes={xyNodes}
        edges={arestas}
        nodeTypes={TIPOS_NO}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        onNodeClick={(_event, node) => onSelecionar(node.id)}
        onPaneClick={() => onSelecionar(null)}
        deleteKeyCode={["Backspace", "Delete"]}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!bg-white" />
      </ReactFlow>
    </div>
  );
}

export function FluxoCanvas(props: FluxoCanvasProps) {
  return (
    <ReactFlowProvider>
      <FluxoCanvasInterno {...props} />
    </ReactFlowProvider>
  );
}
