"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AlertasConfig } from "@/lib/alertas-config";
import type { TipoAlerta } from "@/lib/alertas-tipos";

type Unidade = "min" | "h" | "d";
const MULT: Record<Unidade, number> = { min: 1, h: 60, d: 1440 };

function separar(minutos: number | null): { valor: string; unidade: Unidade } {
  if (minutos === null) return { valor: "", unidade: "h" };
  if (minutos % 1440 === 0) return { valor: String(minutos / 1440), unidade: "d" };
  if (minutos % 60 === 0) return { valor: String(minutos / 60), unidade: "h" };
  return { valor: String(minutos), unidade: "min" };
}

const MENSAGEM_ERRO: Record<string, string> = {
  sem_responsavel_invalido: "O tempo para 'sem responsável' precisa ser um número inteiro entre 1 e 1440 minutos.",
  carencia_invalida: "A tolerância do canal precisa ser um número inteiro entre 0 e 60 minutos.",
  kanban_invalido: "Confira o tempo das etapas do Kanban: use números inteiros maiores que zero (até 90 dias).",
  estagio_invalido: "Uma das etapas não pertence a esta clínica.",
  tipos_invalidos: "Tipo de alerta inválido.",
  forbidden: "Você não tem permissão para configurar alertas.",
};

export type TipoConfig = { id: TipoAlerta; rotulo: string; descricao: string; tecnico: boolean };

const CLASSE_INPUT = "rounded-lg border border-neutral-200 px-3 py-2 text-sm";

export function AlertasConfigForm({ config, tipos }: { config: AlertasConfig; tipos: TipoConfig[] }) {
  const router = useRouter();
  const [desligados, setDesligados] = useState<Set<TipoAlerta>>(new Set(config.tiposDesabilitados));
  const [semResp, setSemResp] = useState(String(config.semResponsavelMinutos));
  const [carencia, setCarencia] = useState(String(config.canalCarenciaMinutos));
  const [regras, setRegras] = useState(() => config.kanbanRegras.map((r) => ({ estagioId: r.estagioId, nome: r.estagioNome, pipeline: r.pipelineNome, ...separar(r.limiteMinutos) })));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  function alternar(id: TipoAlerta, ligado: boolean) {
    setDesligados((prev) => {
      const novo = new Set(prev);
      if (ligado) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setOk(false);
    try {
      // Tipos que esta tela não mostra (técnicos, sem permissão) ficam como estão: só envia os que a pessoa pode editar.
      const visiveis = new Set(tipos.map((t) => t.id));
      const preservados = config.tiposDesabilitados.filter((t) => !visiveis.has(t));
      const res = await fetch("/api/alertas/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiposDesabilitados: [...preservados, ...desligados],
          semResponsavelMinutos: Number(semResp),
          canalCarenciaMinutos: Number(carencia),
          kanbanRegras: regras.map((r) => ({ estagioId: r.estagioId, limiteMinutos: r.valor.trim() === "" ? null : Number(r.valor) * MULT[r.unidade] })),
        }),
      });
      const dados = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!dados.ok) {
        setErro((dados.error && MENSAGEM_ERRO[dados.error]) || "Não deu pra salvar agora.");
        return;
      }
      setOk(true);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-900">Quais alertas ligar</h2>
        <p className="mb-3 text-xs text-neutral-500">Desligar um tipo também encerra os alertas abertos dele.</p>
        <ul className="space-y-3">
          {tipos.map((t) => (
            <li key={t.id}>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={!desligados.has(t.id)} onChange={(e) => alternar(t.id, e.target.checked)} />
                <span>
                  <span className="text-sm font-medium text-neutral-800">
                    {t.rotulo}
                    {t.tecnico && <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">Técnico</span>}
                  </span>
                  <span className="block text-xs text-neutral-500">{t.descricao}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-neutral-500">
          O SLA usa os limites e a faixa de atenção definidos em{" "}
          <a href="/configuracoes/sla" className="font-medium text-teal-700">
            SLA / Atendimento
          </a>
          {config.sla.ativo ? ` (hoje: alerta de atenção a partir de ${config.sla.alertaPercentual}% do limite).` : " — hoje o SLA está desligado, então não há alertas de SLA."}
        </p>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">Tempos</h2>
        <div className="flex flex-wrap gap-6">
          <div>
            <label htmlFor="semResp" className="mb-1 block text-xs font-medium text-neutral-600">
              Conversa sem responsável: alertar após
            </label>
            <div className="flex items-center gap-2">
              <input id="semResp" type="number" min={1} max={1440} value={semResp} onChange={(e) => setSemResp(e.target.value)} className={`${CLASSE_INPUT} w-24`} />
              <span className="text-sm text-neutral-500">min úteis</span>
            </div>
          </div>
          <div>
            <label htmlFor="carencia" className="mb-1 block text-xs font-medium text-neutral-600">
              Canal desconectado: tolerar por
            </label>
            <div className="flex items-center gap-2">
              <input id="carencia" type="number" min={0} max={60} value={carencia} onChange={(e) => setCarencia(e.target.value)} className={`${CLASSE_INPUT} w-24`} />
              <span className="text-sm text-neutral-500">min antes de alertar</span>
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-500">Usa o horário de atendimento configurado: fora do expediente o relógio não anda.</p>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-900">Oportunidade parada — tempo máximo por etapa</h2>
        <p className="mb-3 text-xs text-neutral-500">Deixe em branco para não alertar naquela etapa.</p>
        {regras.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma etapa aberta no Kanban.</p>
        ) : (
          <ul className="space-y-2">
            {regras.map((r, i) => (
              <li key={r.estagioId} className="flex flex-wrap items-center gap-3">
                <span className="w-40 text-sm font-medium text-neutral-800">
                  {r.nome}
                  <span className="block text-[11px] font-normal text-neutral-400">{r.pipeline}</span>
                </span>
                <label className="sr-only" htmlFor={`regra-${r.estagioId}`}>
                  Tempo máximo na etapa {r.nome}
                </label>
                <input
                  id={`regra-${r.estagioId}`}
                  type="number"
                  min={1}
                  value={r.valor}
                  placeholder="sem alerta"
                  onChange={(e) => setRegras((prev) => prev.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))}
                  className={`${CLASSE_INPUT} w-28`}
                />
                <select aria-label={`Unidade da etapa ${r.nome}`} value={r.unidade} onChange={(e) => setRegras((prev) => prev.map((x, j) => (j === i ? { ...x, unidade: e.target.value as Unidade } : x)))} className={CLASSE_INPUT}>
                  <option value="min">minutos</option>
                  <option value="h">horas</option>
                  <option value="d">dias</option>
                </select>
              </li>
            ))}
          </ul>
        )}
      </section>

      {erro && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {erro}
        </p>
      )}
      {ok && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Configuração salva.
        </p>
      )}
      <button type="button" disabled={salvando} onClick={salvar} className="rounded-lg bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
        {salvando ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
