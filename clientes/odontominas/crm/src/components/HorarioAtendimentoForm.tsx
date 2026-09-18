"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ConfiguracaoHorario, PeriodoAtendimento } from "@/lib/horario-atendimento";

const MENSAGEM_ERRO: Record<string, string> = {
  timezone_invalido: "Esse timezone não existe (ex. válido: America/Sao_Paulo).",
  dia_semana_invalido: "Dia da semana inválido.",
  horario_invalido: "Horário em formato inválido (use HH:MM).",
  horario_inicio_maior_que_fim: "O horário de início precisa ser antes do de fim.",
  periodos_sobrepostos: "Dois períodos do mesmo dia não podem se sobrepor.",
};

// Ordem de exibição (segunda primeiro) — o valor interno de cada dia (`diaSemana`)
// continua 0=domingo..6=sábado (Date.prototype.getDay(), ver horario-atendimento.ts).
const DIAS_EXIBICAO: { diaSemana: number; label: string }[] = [
  { diaSemana: 1, label: "Segunda" },
  { diaSemana: 2, label: "Terça" },
  { diaSemana: 3, label: "Quarta" },
  { diaSemana: 4, label: "Quinta" },
  { diaSemana: 5, label: "Sexta" },
  { diaSemana: 6, label: "Sábado" },
  { diaSemana: 0, label: "Domingo" },
];

type LinhaDia = { aberto: boolean; inicio: string; fim: string };

function estadoInicial(config: ConfiguracaoHorario): Record<number, LinhaDia> {
  const porDia: Record<number, LinhaDia> = {};
  for (const { diaSemana } of DIAS_EXIBICAO) porDia[diaSemana] = { aberto: false, inicio: "08:00", fim: "18:00" };

  // UI de hoje só edita 1 período por dia (o backend já suporta mais —
  // ver horario-atendimento.ts). Se um dia tiver mais de 1 período (não
  // acontece hoje, nada escreve isso ainda), só o primeiro aparece aqui.
  for (const p of config.periodos) {
    if (!porDia[p.diaSemana]?.aberto) porDia[p.diaSemana] = { aberto: true, inicio: p.horaInicio, fim: p.horaFim };
  }
  return porDia;
}

export function HorarioAtendimentoForm({ configInicial }: { configInicial: ConfiguracaoHorario }) {
  const router = useRouter();
  const [timezone, setTimezone] = useState(configInicial.timezone);
  const [dias, setDias] = useState<Record<number, LinhaDia>>(estadoInicial(configInicial));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  function atualizarDia(diaSemana: number, patch: Partial<LinhaDia>) {
    setDias((prev) => ({ ...prev, [diaSemana]: { ...prev[diaSemana], ...patch } }));
    setSucesso(false);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setSucesso(false);
    try {
      const periodos: PeriodoAtendimento[] = DIAS_EXIBICAO.filter(({ diaSemana }) => dias[diaSemana].aberto).map(
        ({ diaSemana }) => ({ diaSemana, horaInicio: dias[diaSemana].inicio, horaFim: dias[diaSemana].fim })
      );

      const resposta = await fetch("/api/clinica/horario", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, periodos }),
      });
      const resultado = (await resposta.json()) as { ok: boolean; error?: string };
      if (!resultado.ok) {
        setErro((resultado.error && MENSAGEM_ERRO[resultado.error]) || "Não deu pra salvar.");
        return;
      }
      setSucesso(true);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="divide-y divide-neutral-100">
        {DIAS_EXIBICAO.map(({ diaSemana, label }) => {
          const linha = dias[diaSemana];
          return (
            <div key={diaSemana} className="flex flex-wrap items-center gap-3 py-2.5">
              <label className="flex w-32 shrink-0 items-center gap-2 text-sm font-medium text-neutral-800">
                <input type="checkbox" checked={linha.aberto} onChange={(e) => atualizarDia(diaSemana, { aberto: e.target.checked })} />
                {label}
              </label>
              {linha.aberto ? (
                <div className="flex items-center gap-2 text-sm text-neutral-600">
                  <input
                    type="time"
                    value={linha.inicio}
                    onChange={(e) => atualizarDia(diaSemana, { inicio: e.target.value })}
                    className="rounded-lg border border-neutral-200 px-2 py-1 text-sm"
                  />
                  <span>até</span>
                  <input
                    type="time"
                    value={linha.fim}
                    onChange={(e) => atualizarDia(diaSemana, { fim: e.target.value })}
                    className="rounded-lg border border-neutral-200 px-2 py-1 text-sm"
                  />
                </div>
              ) : (
                <span className="text-sm text-neutral-400">Fechado</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-neutral-100 pt-3">
        <label className="mb-1 block text-xs font-medium text-neutral-600">Timezone da clínica</label>
        <input
          type="text"
          value={timezone}
          onChange={(e) => {
            setTimezone(e.target.value);
            setSucesso(false);
          }}
          placeholder="America/Sao_Paulo"
          className="w-full max-w-xs rounded-lg border border-neutral-200 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-neutral-400">
          Todo cálculo de horário comercial (fila, SLA, automações) vai usar este timezone — nunca o do servidor.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        {sucesso && <span className="text-xs font-medium text-teal-700">Salvo.</span>}
        {erro && <span className="text-xs text-red-600">{erro}</span>}
      </div>
    </div>
  );
}
