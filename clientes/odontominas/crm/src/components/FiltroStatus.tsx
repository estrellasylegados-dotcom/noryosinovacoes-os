import Link from "next/link";
import { STATUS_CONFIG, STATUS_ORDEM, type StatusConversa } from "@/lib/status";

export function FiltroStatus({
  ativo,
  contagens,
  total,
}: {
  ativo?: StatusConversa;
  contagens: Record<StatusConversa, number>;
  total: number;
}) {
  const abas: { valor?: StatusConversa; label: string; count: number }[] = [
    { valor: undefined, label: "Todas", count: total },
    ...STATUS_ORDEM.map((status) => ({ valor: status, label: STATUS_CONFIG[status].label, count: contagens[status] })),
  ];

  return (
    <nav className="flex flex-wrap gap-2">
      {abas.map((aba) => {
        const isAtivo = aba.valor === ativo;
        const href = aba.valor ? `/?status=${aba.valor}` : "/";
        return (
          <Link
            key={aba.label}
            href={href}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              isAtivo ? "bg-teal-700 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {aba.label} <span className="opacity-70">{aba.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
