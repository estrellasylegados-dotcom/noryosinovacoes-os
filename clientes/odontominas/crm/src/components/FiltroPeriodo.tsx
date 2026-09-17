import Link from "next/link";
import { PERIODO_CONFIG, PERIODO_ORDEM, type PeriodoRelatorio } from "@/lib/relatorios";

type Props = {
  ativo: PeriodoRelatorio;
  /** Rota base — default `/resumo` preserva o comportamento de sempre. Campanhas reusa em `/campanhas`. */
  basePath?: string;
  /** Outros query params a manter ao trocar de período (ex.: aba/status selecionado). */
  paramsExtras?: Record<string, string>;
};

export function FiltroPeriodo({ ativo, basePath = "/resumo", paramsExtras }: Props) {
  const sufixo = paramsExtras
    ? Object.entries(paramsExtras)
        .filter(([, v]) => v)
        .map(([k, v]) => `&${k}=${encodeURIComponent(v)}`)
        .join("")
    : "";

  return (
    <nav className="flex flex-wrap gap-2">
      {PERIODO_ORDEM.map((periodo) => (
        <Link
          key={periodo}
          href={`${basePath}?periodo=${periodo}${sufixo}`}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            periodo === ativo ? "bg-teal-700 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          {PERIODO_CONFIG[periodo].label}
        </Link>
      ))}
    </nav>
  );
}
