"use client";

import { useState, type ReactNode } from "react";

export function AbasRelatorio({
  abas,
}: {
  abas: { valor: string; label: string; conteudo: ReactNode }[];
}) {
  const [ativa, setAtiva] = useState(abas[0]?.valor);

  return (
    <div>
      <div className="mb-4 flex gap-1 border-b border-neutral-200">
        {abas.map((aba) => (
          <button
            key={aba.valor}
            type="button"
            onClick={() => setAtiva(aba.valor)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              ativa === aba.valor
                ? "border-teal-700 text-teal-800"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {aba.label}
          </button>
        ))}
      </div>
      {abas.find((a) => a.valor === ativa)?.conteudo}
    </div>
  );
}
