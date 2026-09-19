import type { Severidade } from "@/lib/alertas-tipos";

/**
 * Severidade nunca depende só de cor: cada nível tem ÍCONE e TEXTO próprios
 * (crítico = círculo com "!", atenção = triângulo, informativo = "i").
 */

const ESTILO: Record<Severidade, { rotulo: string; classe: string }> = {
  critico: { rotulo: "CRÍTICO", classe: "bg-red-50 text-red-700 ring-red-200" },
  atencao: { rotulo: "ATENÇÃO", classe: "bg-amber-50 text-amber-800 ring-amber-200" },
  informativo: { rotulo: "INFORMATIVO", classe: "bg-sky-50 text-sky-800 ring-sky-200" },
};

function Icone({ severidade }: { severidade: Severidade }) {
  const props = { viewBox: "0 0 24 24", width: 13, height: 13, fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (severidade === "critico") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16.5v.5" />
      </svg>
    );
  }
  if (severidade === "atencao") {
    return (
      <svg {...props}>
        <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17v.5" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5v.5" />
    </svg>
  );
}

export function SeveridadeBadge({ severidade }: { severidade: Severidade }) {
  const e = ESTILO[severidade];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ring-inset ${e.classe}`}>
      <Icone severidade={severidade} />
      {e.rotulo}
    </span>
  );
}
