/**
 * Posição (x/y) de cada nó e viewport (zoom/pan) do canvas — puro estado
 * visual, a engine nunca lê isso. Guardado em `FluxoDefinicao.config.layout`
 * (não em `edges`, que fica reservado mas sem uso nesta fase, e não em
 * `fluxo-tipos.ts`, que fica intocado): `config: Record<string, unknown>`
 * já é o "saco livre" que `validarFormaDefinicao` só confere como objeto,
 * sem inspecionar por dentro — usar esse espaço é zero mudança de schema/
 * engine. Parsing defensivo, hand-rolled (mesmo critério do resto do
 * projeto): qualquer coisa malformada cai no fallback vazio, nunca lança.
 */

import { derivarArestasXyflow } from "@/lib/fluxo-editor-grafo";
import type { NoFluxo } from "@/lib/fluxo-tipos";

export type PosicaoNo = { x: number; y: number };
export type ViewportEditor = { x: number; y: number; zoom: number };
export type LayoutEditor = { posicoes: Record<string, PosicaoNo>; viewport?: ViewportEditor };

const LAYOUT_VAZIO: LayoutEditor = { posicoes: {} };

function ehPosicaoValida(v: unknown): v is PosicaoNo {
  return typeof v === "object" && v !== null && typeof (v as PosicaoNo).x === "number" && typeof (v as PosicaoNo).y === "number";
}

function ehViewportValido(v: unknown): v is ViewportEditor {
  if (typeof v !== "object" || v === null) return false;
  const vp = v as ViewportEditor;
  return typeof vp.x === "number" && typeof vp.y === "number" && typeof vp.zoom === "number";
}

export function lerLayoutEditor(config: Record<string, unknown>): LayoutEditor {
  const bruto = config.layout;
  if (typeof bruto !== "object" || bruto === null) return LAYOUT_VAZIO;
  const l = bruto as Record<string, unknown>;

  const posicoes: Record<string, PosicaoNo> = {};
  if (typeof l.posicoes === "object" && l.posicoes !== null) {
    for (const [noId, posicao] of Object.entries(l.posicoes as Record<string, unknown>)) {
      if (ehPosicaoValida(posicao)) posicoes[noId] = { x: posicao.x, y: posicao.y };
    }
  }

  const viewport = ehViewportValido(l.viewport) ? l.viewport : undefined;

  return viewport ? { posicoes, viewport } : { posicoes };
}

export function escreverLayoutEditor(config: Record<string, unknown>, layout: LayoutEditor): Record<string, unknown> {
  return { ...config, layout };
}

export function atualizarPosicaoNo(layout: LayoutEditor, noId: string, posicao: PosicaoNo): LayoutEditor {
  return { ...layout, posicoes: { ...layout.posicoes, [noId]: posicao } };
}

export function removerPosicaoNo(layout: LayoutEditor, noId: string): LayoutEditor {
  const posicoes = { ...layout.posicoes };
  delete posicoes[noId];
  return { ...layout, posicoes };
}

const LARGURA_NIVEL = 260;
const ALTURA_ENTRE_NOS = 150;

/**
 * Layout inicial em camadas (BFS a partir do início) — usado ao abrir um
 * template ou um fluxo novo sem posições salvas ainda, pra não empilhar
 * todos os nós em (0,0). Reaproveita `derivarArestasXyflow` em vez de
 * duplicar a travessia do grafo (mesma fonte de verdade de "pra onde este
 * nó aponta" que o canvas já usa).
 */
export function gerarLayoutAutomatico(nodes: NoFluxo[]): Record<string, PosicaoNo> {
  const arestas = derivarArestasXyflow(nodes);
  const adjacencia = new Map<string, string[]>();
  for (const aresta of arestas) {
    adjacencia.set(aresta.source, [...(adjacencia.get(aresta.source) ?? []), aresta.target]);
  }

  const inicio = nodes.find((n) => n.tipo === "inicio") ?? nodes[0];
  const nivelPorNo = new Map<string, number>();
  if (inicio) {
    const fila: Array<{ id: string; nivel: number }> = [{ id: inicio.id, nivel: 0 }];
    while (fila.length > 0) {
      const { id, nivel } = fila.shift()!;
      if (nivelPorNo.has(id)) continue;
      nivelPorNo.set(id, nivel);
      for (const alvo of adjacencia.get(id) ?? []) {
        if (!nivelPorNo.has(alvo)) fila.push({ id: alvo, nivel: nivel + 1 });
      }
    }
  }

  const maiorNivelAlcancado = Math.max(0, ...nivelPorNo.values());
  let proximoNivelOrfaos = maiorNivelAlcancado + 1;
  const contadorPorNivel = new Map<number, number>();
  const posicoes: Record<string, PosicaoNo> = {};

  for (const no of nodes) {
    const nivel = nivelPorNo.get(no.id) ?? proximoNivelOrfaos++;
    const indiceNoNivel = contadorPorNivel.get(nivel) ?? 0;
    contadorPorNivel.set(nivel, indiceNoNivel + 1);
    posicoes[no.id] = { x: nivel * LARGURA_NIVEL, y: indiceNoNivel * ALTURA_ENTRE_NOS };
  }

  return posicoes;
}
