"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SlaConfig } from "@/lib/sla";

const MENSAGEM_ERRO: Record<string, string> = {
  primeira_resposta_invalida: "Minutos de primeira resposta precisa ser um número inteiro maior que zero.",
  resposta_atendimento_invalida: "Minutos de resposta em atendimento precisa ser um número inteiro maior que zero.",
  alerta_invalido: "Alerta preventivo precisa ser entre 1% e 100%.",
};

const CLASSE_INPUT = "w-24 rounded-lg border border-neutral-200 px-3 py-2 text-sm";

export function SlaConfigForm({ configInicial, horarioConfigurado }: { configInicial: SlaConfig; horarioConfigurado: boolean }) {
  const router = useRouter();
  const [ativo, setAtivo] = useState(configInicial.ativo);
  const [primeiraResposta, setPrimeiraResposta] = useState(String(configInicial.primeiraRespostaMinutos));
  const [respostaAtendimento, setRespostaAtendimento] = useState(String(configInicial.respostaAtendimentoMinutos));
  const [alertaPercentual, setAlertaPercentual] = useState(String(configInicial.alertaPercentual));
  const [considerarHorarioUtil, setConsiderarHorarioUtil] = useState(configInicial.considerarApenasHorarioUtil);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setSucesso(false);
    try {
      const resposta = await fetch("/api/clinica/sla", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ativo,
          primeiraRespostaMinutos: Number(primeiraResposta),
          respostaAtendimentoMinutos: Number(respostaAtendimento),
          alertaPercentual: Number(alertaPercentual),
          considerarApenasHorarioUtil: considerarHorarioUtil,
        }),
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

  const podeAtivar = horarioConfigurado || !considerarHorarioUtil;

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
      {considerarHorarioUtil && !horarioConfigurado && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Configure o horário de atendimento antes de ativar o SLA em minutos úteis.
        </p>
      )}

      <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
        <input type="checkbox" checked={ativo} disabled={!podeAtivar} onChange={(e) => setAtivo(e.target.checked)} />
        Ativar SLA
      </label>

      <div className="flex flex-wrap items-center gap-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Primeira resposta</label>
          <div className="flex items-center gap-2">
            <input type="number" min={1} value={primeiraResposta} onChange={(e) => setPrimeiraResposta(e.target.value)} className={CLASSE_INPUT} />
            <span className="text-sm text-neutral-500">min úteis</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Resposta em atendimento</label>
          <div className="flex items-center gap-2">
            <input type="number" min={1} value={respostaAtendimento} onChange={(e) => setRespostaAtendimento(e.target.value)} className={CLASSE_INPUT} />
            <span className="text-sm text-neutral-500">min úteis</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Avisar quando atingir</label>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={100} value={alertaPercentual} onChange={(e) => setAlertaPercentual(e.target.value)} className={CLASSE_INPUT} />
            <span className="text-sm text-neutral-500">%</span>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" checked={considerarHorarioUtil} onChange={(e) => setConsiderarHorarioUtil(e.target.checked)} />
        Considerar somente horário de atendimento (recomendado — desligar conta minutos corridos, 24x7, sem pausar fora do expediente)
      </label>

      <p className="text-xs text-neutral-400">O SLA considera apenas o horário de atendimento configurado, não o relógio corrido.</p>

      <div className="flex items-center gap-3">
        <button type="button" onClick={salvar} disabled={salvando} className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        {sucesso && <span className="text-xs font-medium text-teal-700">Salvo.</span>}
        {erro && <span className="text-xs text-red-600">{erro}</span>}
      </div>
    </div>
  );
}
