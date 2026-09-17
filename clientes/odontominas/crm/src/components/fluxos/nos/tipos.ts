import type { NoFluxo } from "@/lib/fluxo-tipos";

/**
 * `data` de cada nó do xyflow — o `NoFluxo` real (fonte da verdade) mais
 * metadado só-visual computado pelo editor (nunca persistido dentro do
 * próprio nó). `etiquetaNomePorId`/`atendenteNomePorId` resolvem o id cru dos
 * nós de Ações CRM (`adicionar_etiqueta`/`remover_etiqueta`/
 * `atribuir_atendente`) pro nome de verdade no card do canvas — sem eles o
 * card mostraria um UUID cru; o painel de propriedades já resolve via
 * dropdown, isso é só o glance do canvas.
 */
export type NoCanvasData = {
  no: NoFluxo;
  problema?: "erro" | "aviso";
  emExecucao?: boolean;
  etiquetaNomePorId?: Map<string, string>;
  atendenteNomePorId?: Map<string, string>;
};
