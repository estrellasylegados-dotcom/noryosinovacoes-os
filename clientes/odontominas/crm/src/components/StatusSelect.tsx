"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STATUS_CONFIG, STATUS_ORDEM, type StatusConversa } from "@/lib/status";

export function StatusSelect({
  conversaId,
  statusAtual,
}: {
  conversaId: string;
  statusAtual: StatusConversa;
}) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(false);
  const cfg = STATUS_CONFIG[statusAtual];

  async function mudarStatus(novoStatus: StatusConversa) {
    if (novoStatus === statusAtual) return;
    setSalvando(true);
    setErro(false);
    try {
      const resposta = await fetch(`/api/conversas/${conversaId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (!resposta.ok) throw new Error("falhou");
      router.refresh();
    } catch {
      setErro(true);
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <select
        value={statusAtual}
        disabled={salvando}
        onChange={(e) => mudarStatus(e.target.value as StatusConversa)}
        className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-xs font-medium ring-1 ring-inset disabled:cursor-wait disabled:opacity-60 ${cfg.corBadge}`}
      >
        {STATUS_ORDEM.map((status) => (
          <option key={status} value={status}>
            {STATUS_CONFIG[status].label}
          </option>
        ))}
      </select>
      {erro && <span className="text-[11px] text-red-600">Não salvou, tenta de novo</span>}
    </div>
  );
}
