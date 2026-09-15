import Link from "next/link";
import { PERIODO_CONFIG, PERIODO_ORDEM, type PeriodoRelatorio } from "@/lib/relatorios";

export function FiltroPeriodo({ ativo }: { ativo: PeriodoRelatorio }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {PERIODO_ORDEM.map((periodo) => (
        <Link
          key={periodo}
          href={`/resumo?periodo=${periodo}`}
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
