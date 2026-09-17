import type { NoFluxo } from "@/lib/fluxo-tipos";

/** `data` de cada nó do xyflow — o `NoFluxo` real (fonte da verdade) mais metadado só-visual computado pelo editor (nunca persistido dentro do próprio nó). */
export type NoCanvasData = {
  no: NoFluxo;
  problema?: "erro" | "aviso";
  emExecucao?: boolean;
};
