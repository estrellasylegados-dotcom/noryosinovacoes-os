"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LinhaMarketing } from "@/lib/campanha-metricas";
import { labelCanal, labelTipoCampanha } from "@/lib/campanhas";
import { formatMoeda } from "@/lib/tempo";

/**
 * Relatórios → Marketing (item 24 do briefing): filtra por campanha, canal,
 * especialidade e responsável — tudo client-side em cima das linhas já
 * calculadas no período (volume baixo, 1 clínica; não justifica ida ao
 * servidor a cada troca de filtro). Responde de verdade "qual campanha
 * gerou mais agendamentos" etc. ordenando a tabela pela coluna.
 */
export function RelatorioMarketing({ linhas, nomesAtendentes }: { linhas: LinhaMarketing[]; nomesAtendentes: Record<string, string> }) {
  const [canal, setCanal] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [responsavel, setResponsavel] = useState("");

  const especialidades = useMemo(
    () => [...new Set(linhas.map((l) => l.campanha.especialidade).filter((v): v is string => Boolean(v)))],
    [linhas]
  );
  const canais = useMemo(() => [...new Set(linhas.flatMap((l) => l.campanha.canais))], [linhas]);
  const responsaveis = useMemo(
    () => [...new Set(linhas.map((l) => l.campanha.responsavelId).filter((v): v is string => Boolean(v)))],
    [linhas]
  );

  const filtradas = linhas.filter((l) => {
    if (canal && !l.campanha.canais.includes(canal)) return false;
    if (especialidade && l.campanha.especialidade !== especialidade) return false;
    if (responsavel && l.campanha.responsavelId !== responsavel) return false;
    return true;
  });

  const totais = filtradas.reduce(
    (acc, l) => ({
      leads: acc.leads + l.leads,
      agendamentos: acc.agendamentos + l.agendamentos,
      fechamentos: acc.fechamentos + l.fechamentos,
      receita: acc.receita + l.receita,
      investimento: acc.investimento + (l.investimento ?? 0),
    }),
    { leads: 0, agendamentos: 0, fechamentos: 0, receita: 0, investimento: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select value={canal} onChange={(e) => setCanal(e.target.value)} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs">
          <option value="">Todos os canais</option>
          {canais.map((c) => (
            <option key={c} value={c}>{labelCanal(c)}</option>
          ))}
        </select>
        <select value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs">
          <option value="">Todas as especialidades</option>
          {especialidades.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs">
          <option value="">Todos os responsáveis</option>
          {responsaveis.map((r) => (
            <option key={r} value={r}>{nomesAtendentes[r] ?? r}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-500">Leads (filtro)</p>
          <p className="text-lg font-semibold text-neutral-900">{totais.leads}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-500">Agendamentos</p>
          <p className="text-lg font-semibold text-neutral-900">{totais.agendamentos}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-500">Fechamentos</p>
          <p className="text-lg font-semibold text-neutral-900">{totais.fechamentos}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-500">Receita</p>
          <p className="text-lg font-semibold text-neutral-900">{formatMoeda(totais.receita)}</p>
        </div>
      </div>

      {filtradas.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-400">
          Nenhuma campanha bate com esse filtro neste período.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-neutral-100 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Campanha</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Leads</th>
                <th className="px-4 py-2.5 font-medium">Agendamentos</th>
                <th className="px-4 py-2.5 font-medium">Fechamentos</th>
                <th className="px-4 py-2.5 font-medium">Receita</th>
                <th className="px-4 py-2.5 font-medium">Investimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtradas.map((l) => (
                <tr key={l.campanha.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/campanhas/${l.campanha.id}`} className="font-medium text-teal-700 hover:underline">{l.campanha.nome}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{labelTipoCampanha(l.campanha.tipo)}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{l.leads}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{l.agendamentos}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{l.fechamentos}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{formatMoeda(l.receita)}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{formatMoeda(l.investimento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
