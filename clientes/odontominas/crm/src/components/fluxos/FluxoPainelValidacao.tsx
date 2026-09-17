"use client";

import type { ProblemaGrafo } from "@/lib/fluxo-validador";

export function FluxoPainelValidacao({
  erros,
  avisos,
  onSelecionarProblema,
}: {
  erros: ProblemaGrafo[];
  avisos: ProblemaGrafo[];
  onSelecionarProblema: (noIds: string[]) => void;
}) {
  if (erros.length === 0 && avisos.length === 0) {
    return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Sem erros nem avisos.</p>;
  }

  return (
    <div className="space-y-1.5">
      {erros.map((problema, indice) => (
        <button
          key={`erro-${indice}`}
          type="button"
          onClick={() => onSelecionarProblema(problema.noIds)}
          className="block w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-xs text-red-700 hover:bg-red-100"
        >
          {problema.mensagem}
        </button>
      ))}
      {avisos.map((problema, indice) => (
        <button
          key={`aviso-${indice}`}
          type="button"
          onClick={() => onSelecionarProblema(problema.noIds)}
          className="block w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-amber-700 hover:bg-amber-100"
        >
          {problema.mensagem}
        </button>
      ))}
    </div>
  );
}
