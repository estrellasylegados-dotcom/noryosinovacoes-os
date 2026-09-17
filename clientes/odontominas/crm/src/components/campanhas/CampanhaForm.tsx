"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  OBJETIVOS_CAMPANHA,
  TIPOS_CAMPANHA,
  CANAIS_CAMPANHA,
  type Campanha,
  type DadosCampanha,
  type MetasCampanha,
} from "@/lib/campanhas";
import { CAMPANHA_TEMPLATES } from "@/lib/campanha-templates";
import type { Audiencia, FiltroAudiencia, ResultadoPublico } from "@/lib/audiencias";
import type { Etiqueta } from "@/lib/etiquetas";
import { STATUS_CONFIG, STATUS_ORDEM, type StatusConversa } from "@/lib/status";

/**
 * Formulário único de Campanha, dois modos sobre o mesmo estado (mesmo
 * truque do AgenteForm.tsx: presença de `campanha` decide se é edição):
 * `modo="criacao"` renderiza como wizard linear de 8 passos (item 33 do
 * briefing); `modo="edicao"` renderiza as mesmas 8 seções como abas livres
 * (estilo AgenteForm). Só importa `type` de audiencias/etiquetas — leitura e
 * gravação de verdade sempre por `/api/*`, nunca lib direta no bundle do
 * navegador (mesma disciplina do comentário em DisparosWizard.tsx).
 */

type Props = {
  modo: "criacao" | "edicao";
  campanha?: Campanha;
  audiencias: Audiencia[];
  etiquetas: Etiqueta[];
  atendentes: { id: string; nome: string }[];
  agentes: { id: string; nome: string }[];
};

const TITULOS = [
  "Informações básicas",
  "Objetivo",
  "Público",
  "Canais",
  "Disparos e Agente de IA",
  "Metas",
  "Tracking",
  "Revisão",
] as const;

type MetaCampo = keyof MetasCampanha;
const METAS_CAMPOS: { campo: MetaCampo; label: string }[] = [
  { campo: "leads", label: "Leads" },
  { campo: "respostas", label: "Respostas" },
  { campo: "agendamentos", label: "Agendamentos" },
  { campo: "comparecimentos", label: "Comparecimentos" },
  { campo: "fechamentos", label: "Fechamentos" },
  { campo: "receita", label: "Receita (R$)" },
  { campo: "cpl", label: "CPL alvo (R$)" },
  { campo: "cpa", label: "CPA alvo (R$)" },
  { campo: "roas", label: "ROAS alvo" },
];

const campoClasses = "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-teal-600";

function Campo({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-neutral-500">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-neutral-900">{titulo}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function CampanhaForm({ modo, campanha, audiencias, etiquetas, atendentes, agentes }: Props) {
  const router = useRouter();
  const editando = Boolean(campanha);
  const [secaoAtual, setSecaoAtual] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // 1. Informações básicas
  const [nome, setNome] = useState(campanha?.nome ?? "");
  const [descricao, setDescricao] = useState(campanha?.descricao ?? "");
  const [responsavelId, setResponsavelId] = useState(campanha?.responsavelId ?? "");
  const [dataInicio, setDataInicio] = useState(campanha?.dataInicio ?? "");
  const [dataFim, setDataFim] = useState(campanha?.dataFim ?? "");

  // 2. Objetivo / tipo / especialidade
  const objetivoConhecido = OBJETIVOS_CAMPANHA.some((o) => o.valor === campanha?.objetivo);
  const tipoConhecido = TIPOS_CAMPANHA.some((t) => t.valor === campanha?.tipo);
  const [objetivo, setObjetivo] = useState(campanha ? (objetivoConhecido ? campanha.objetivo : "outro") : "gerar_agendamentos");
  const [objetivoOutro, setObjetivoOutro] = useState(campanha && !objetivoConhecido ? campanha.objetivo : "");
  const [tipo, setTipo] = useState(campanha ? (tipoConhecido ? campanha.tipo : "outro") : "implantes");
  const [tipoOutro, setTipoOutro] = useState(campanha && !tipoConhecido ? campanha.tipo : "");
  const [especialidade, setEspecialidade] = useState(campanha?.especialidade ?? "");

  // 3. Público
  const [audienciaModo, setAudienciaModo] = useState<"nenhuma" | "existente" | "nova">(
    campanha?.audienciaId ? "existente" : "nenhuma"
  );
  const [audienciaId, setAudienciaId] = useState(campanha?.audienciaId ?? audiencias[0]?.id ?? "");
  const [etiquetaIds, setEtiquetaIds] = useState<string[]>([]);
  const [etiquetaModo, setEtiquetaModo] = useState<"todas" | "qualquer">("qualquer");
  const [statusSelecionados, setStatusSelecionados] = useState<StatusConversa[]>([]);
  const [inativoHaDias, setInativoHaDias] = useState("");
  const [nomeNovaAudiencia, setNomeNovaAudiencia] = useState("");
  const [preview, setPreview] = useState<ResultadoPublico | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);

  // 4. Canais
  const [canais, setCanais] = useState<string[]>(campanha?.canais ?? []);

  // 5. Disparos/Fluxos + Agente de IA
  const [agenteIaId, setAgenteIaId] = useState(campanha?.agenteIaId ?? "");

  // 6. Metas
  const [metas, setMetas] = useState<Partial<Record<MetaCampo, string>>>(() => {
    const inicial: Partial<Record<MetaCampo, string>> = {};
    if (campanha?.metas) {
      for (const { campo } of METAS_CAMPOS) {
        const v = campanha.metas[campo];
        if (v !== undefined) inicial[campo] = String(v);
      }
    }
    return inicial;
  });

  // 7. Tracking
  const [dominio, setDominio] = useState(campanha?.dominio ?? "");
  const [slug, setSlug] = useState(campanha?.slug ?? "");
  const [utmSource, setUtmSource] = useState(campanha?.utmSource ?? "");
  const [utmMedium, setUtmMedium] = useState(campanha?.utmMedium ?? "");
  const [utmCampaign, setUtmCampaign] = useState(campanha?.utmCampaign ?? "");
  const [utmContent, setUtmContent] = useState(campanha?.utmContent ?? "");
  const [utmTerm, setUtmTerm] = useState(campanha?.utmTerm ?? "");
  const [metaAdsCampaignId, setMetaAdsCampaignId] = useState(campanha?.metaAdsCampaignId ?? "");
  const [googleAdsCampaignId, setGoogleAdsCampaignId] = useState(campanha?.googleAdsCampaignId ?? "");
  const [investimentoPlanejado, setInvestimentoPlanejado] = useState(
    campanha?.investimentoPlanejado !== null && campanha?.investimentoPlanejado !== undefined ? String(campanha.investimentoPlanejado) : ""
  );
  const [investimentoReal, setInvestimentoReal] = useState(
    campanha?.investimentoReal !== null && campanha?.investimentoReal !== undefined ? String(campanha.investimentoReal) : ""
  );

  const filtroAtual: FiltroAudiencia = useMemo(
    () => ({
      etiquetaIds: etiquetaIds.length > 0 ? etiquetaIds : undefined,
      etiquetaModo: etiquetaIds.length > 1 ? etiquetaModo : undefined,
      statusConversa: statusSelecionados.length > 0 ? statusSelecionados : undefined,
      inativoHaDias: inativoHaDias.trim() ? Number(inativoHaDias) : undefined,
    }),
    [etiquetaIds, etiquetaModo, statusSelecionados, inativoHaDias]
  );

  function toggleEtiqueta(id: string) {
    setEtiquetaIds((atual) => (atual.includes(id) ? atual.filter((e) => e !== id) : [...atual, id]));
    setPreview(null);
  }
  function toggleStatus(status: StatusConversa) {
    setStatusSelecionados((atual) => (atual.includes(status) ? atual.filter((s) => s !== status) : [...atual, status]));
    setPreview(null);
  }
  function toggleCanal(valor: string) {
    setCanais((atual) => (atual.includes(valor) ? atual.filter((c) => c !== valor) : [...atual, valor]));
  }

  async function calcularPreview() {
    setCarregandoPreview(true);
    try {
      const res = await fetch("/api/disparos/preview-audiencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filtro: filtroAtual }),
      });
      const corpo = await res.json();
      if (corpo.ok) setPreview(corpo.resultado as ResultadoPublico);
    } catch {
      // é só uma prévia
    } finally {
      setCarregandoPreview(false);
    }
  }

  function aplicarTemplate(id: string) {
    const t = CAMPANHA_TEMPLATES.find((tpl) => tpl.id === id);
    if (!t) return;
    setObjetivo(OBJETIVOS_CAMPANHA.some((o) => o.valor === t.objetivo) ? t.objetivo : "outro");
    setTipo(TIPOS_CAMPANHA.some((tp) => tp.valor === t.tipo) ? t.tipo : "outro");
    setCanais(t.canaisSugeridos);
    const metasIniciais: Partial<Record<MetaCampo, string>> = {};
    for (const [campo, valor] of Object.entries(t.metasSugeridas)) metasIniciais[campo as MetaCampo] = String(valor);
    setMetas(metasIniciais);
    if (!nome.trim()) setNome(t.nome);
  }

  function montarPayload(): Partial<DadosCampanha> {
    const metasFinal: MetasCampanha = {};
    for (const { campo } of METAS_CAMPOS) {
      const bruto = metas[campo];
      if (bruto && bruto.trim()) metasFinal[campo] = Number(bruto);
    }

    return {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      responsavelId: responsavelId || null,
      objetivo: objetivo === "outro" ? objetivoOutro.trim() : objetivo,
      tipo: tipo === "outro" ? tipoOutro.trim() : tipo,
      especialidade: especialidade.trim() || null,
      dataInicio: dataInicio || null,
      dataFim: dataFim || null,
      audienciaId: audienciaModo === "existente" ? audienciaId || null : null,
      agenteIaId: agenteIaId || null,
      canais,
      metas: metasFinal,
      dominio: dominio.trim() || null,
      slug: slug.trim() || null,
      utmSource: utmSource.trim() || null,
      utmMedium: utmMedium.trim() || null,
      utmCampaign: utmCampaign.trim() || null,
      utmContent: utmContent.trim() || null,
      utmTerm: utmTerm.trim() || null,
      metaAdsCampaignId: metaAdsCampaignId.trim() || null,
      googleAdsCampaignId: googleAdsCampaignId.trim() || null,
      investimentoPlanejado: investimentoPlanejado.trim() ? Number(investimentoPlanejado) : null,
      investimentoReal: investimentoReal.trim() ? Number(investimentoReal) : null,
    };
  }

  async function salvar() {
    if (!nome.trim()) {
      setErro("Preencha o nome da campanha.");
      setSecaoAtual(1);
      return;
    }
    const objetivoFinal = objetivo === "outro" ? objetivoOutro.trim() : objetivo;
    if (!objetivoFinal) {
      setErro("Escolha (ou descreva) o objetivo da campanha.");
      setSecaoAtual(2);
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      let audienciaIdFinal = audienciaModo === "existente" ? audienciaId || null : null;

      if (audienciaModo === "nova" && nomeNovaAudiencia.trim()) {
        const resAudiencia = await fetch("/api/audiencias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: nomeNovaAudiencia.trim(), filtro: filtroAtual }),
        });
        const corpoAudiencia = await resAudiencia.json();
        if (corpoAudiencia.ok) audienciaIdFinal = corpoAudiencia.id;
      }

      const payload = { ...montarPayload(), audienciaId: audienciaIdFinal };

      const res = await fetch(editando ? `/api/campanhas/${campanha!.id}` : "/api/campanhas", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const corpo = await res.json();
      if (!corpo.ok) {
        setErro("Não consegui salvar a campanha agora.");
        return;
      }
      router.push(`/campanhas/${editando ? campanha!.id : corpo.id}`);
      router.refresh();
    } catch {
      setErro("Não consegui salvar a campanha agora.");
    } finally {
      setSalvando(false);
    }
  }

  function renderSecao(n: number) {
    switch (n) {
      case 1:
        return (
          <Secao titulo="Informações básicas">
            {modo === "criacao" && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-neutral-500">Começar de um template (opcional)</p>
                <div className="flex flex-wrap gap-1.5">
                  {CAMPANHA_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => aplicarTemplate(t.id)}
                      className="rounded-full px-2.5 py-1 text-xs font-medium text-neutral-600 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-50"
                    >
                      {t.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Campo label="Nome da campanha">
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Implantes Setembro" className={campoClasses} />
            </Campo>
            <Campo label="Descrição">
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className={campoClasses} />
            </Campo>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Campo label="Responsável">
                <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className={campoClasses}>
                  <option value="">—</option>
                  {atendentes.map((a) => (
                    <option key={a.id} value={a.id}>{a.nome}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Data de início">
                <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className={campoClasses} />
              </Campo>
              <Campo label="Data de término">
                <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className={campoClasses} />
              </Campo>
            </div>
          </Secao>
        );
      case 2:
        return (
          <Secao titulo="Objetivo, tipo e especialidade">
            <Campo label="Qual o objetivo da campanha?">
              <select value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className={campoClasses}>
                {OBJETIVOS_CAMPANHA.map((o) => (
                  <option key={o.valor} value={o.valor}>{o.label}</option>
                ))}
              </select>
              {objetivo === "outro" && (
                <input
                  type="text"
                  value={objetivoOutro}
                  onChange={(e) => setObjetivoOutro(e.target.value)}
                  placeholder="Descreva o objetivo"
                  className={`${campoClasses} mt-2`}
                />
              )}
            </Campo>
            <Campo label="Tipo de campanha">
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campoClasses}>
                {TIPOS_CAMPANHA.map((t) => (
                  <option key={t.valor} value={t.valor}>{t.label}</option>
                ))}
              </select>
              {tipo === "outro" && (
                <input
                  type="text"
                  value={tipoOutro}
                  onChange={(e) => setTipoOutro(e.target.value)}
                  placeholder="Descreva o tipo"
                  className={`${campoClasses} mt-2`}
                />
              )}
            </Campo>
            <Campo label="Especialidade (opcional)">
              <input type="text" value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} placeholder="ex.: Implantes" className={campoClasses} />
            </Campo>
          </Secao>
        );
      case 3:
        return (
          <Secao titulo="Público">
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={audienciaModo === "nenhuma"} onChange={() => setAudienciaModo("nenhuma")} />
                Nenhuma agora
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={audienciaModo === "existente"} onChange={() => setAudienciaModo("existente")} disabled={audiencias.length === 0} />
                Audiência salva
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={audienciaModo === "nova"} onChange={() => setAudienciaModo("nova")} />
                Montar agora
              </label>
            </div>

            {audienciaModo === "existente" && (
              audiencias.length === 0 ? (
                <p className="text-sm text-neutral-400">Nenhuma audiência salva ainda.</p>
              ) : (
                <select value={audienciaId} onChange={(e) => setAudienciaId(e.target.value)} className={campoClasses}>
                  {audiencias.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome} {a.ultimaContagem !== null ? `(~${a.ultimaContagem} contato(s))` : ""}
                    </option>
                  ))}
                </select>
              )
            )}

            {audienciaModo === "nova" && (
              <div className="space-y-3">
                {etiquetas.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-neutral-500">Etiquetas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {etiquetas.map((et) => (
                        <button
                          key={et.id}
                          type="button"
                          onClick={() => toggleEtiqueta(et.id)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                            etiquetaIds.includes(et.id) ? "bg-teal-700 text-white ring-teal-700" : "text-neutral-600 ring-neutral-200 hover:bg-neutral-50"
                          }`}
                        >
                          {et.nome}
                        </button>
                      ))}
                    </div>
                    {etiquetaIds.length > 1 && (
                      <div className="mt-2 flex gap-4 text-xs text-neutral-600">
                        <label className="flex items-center gap-1.5">
                          <input type="radio" checked={etiquetaModo === "qualquer"} onChange={() => setEtiquetaModo("qualquer")} /> Qualquer uma
                        </label>
                        <label className="flex items-center gap-1.5">
                          <input type="radio" checked={etiquetaModo === "todas"} onChange={() => setEtiquetaModo("todas")} /> Todas
                        </label>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <p className="mb-1.5 text-xs font-medium text-neutral-500">Status da conversa</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_ORDEM.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleStatus(s)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                          statusSelecionados.includes(s) ? "bg-teal-700 text-white ring-teal-700" : "text-neutral-600 ring-neutral-200 hover:bg-neutral-50"
                        }`}
                      >
                        {STATUS_CONFIG[s].label}
                      </button>
                    ))}
                  </div>
                </div>

                <Campo label="Inativo há pelo menos (dias)">
                  <input
                    type="number"
                    min={1}
                    value={inativoHaDias}
                    onChange={(e) => {
                      setInativoHaDias(e.target.value);
                      setPreview(null);
                    }}
                    placeholder="ex.: 30"
                    className="w-32 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Campo>

                <div className="border-t border-neutral-100 pt-3">
                  <button
                    type="button"
                    onClick={calcularPreview}
                    disabled={carregandoPreview}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
                  >
                    {carregandoPreview ? "Calculando…" : "Calcular público"}
                  </button>
                  {preview && (
                    <p className="mt-2 text-sm text-neutral-600">
                      <strong className="text-emerald-700">{preview.elegiveis.length}</strong> elegível(is) de {preview.totalEncontrados} encontrado(s)
                    </p>
                  )}
                </div>

                <Campo label="Salvar como audiência reutilizável (opcional)" hint="Deixe em branco pra não salvar — a campanha guarda o filtro do mesmo jeito.">
                  <input
                    type="text"
                    value={nomeNovaAudiencia}
                    onChange={(e) => setNomeNovaAudiencia(e.target.value)}
                    placeholder="ex.: Inativos 60 dias"
                    className={campoClasses}
                  />
                </Campo>
              </div>
            )}
          </Secao>
        );
      case 4:
        return (
          <Secao titulo="Canais">
            <div className="flex flex-wrap gap-1.5">
              {CANAIS_CAMPANHA.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  onClick={() => toggleCanal(c.valor)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                    canais.includes(c.valor) ? "bg-teal-700 text-white ring-teal-700" : "text-neutral-600 ring-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </Secao>
        );
      case 5:
        return (
          <Secao titulo="Disparos e Agente de IA">
            <Campo label="Agente de IA responsável (opcional)" hint="Quando um lead entrar por esta campanha, a IA passa a saber a origem na conversa.">
              <select value={agenteIaId} onChange={(e) => setAgenteIaId(e.target.value)} className={campoClasses}>
                <option value="">—</option>
                {agentes.map((a) => (
                  <option key={a.id} value={a.id}>{a.nome}</option>
                ))}
              </select>
            </Campo>
            <p className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">
              {editando
                ? "Os disparos vinculados a esta campanha aparecem no painel da campanha, depois de salvar."
                : "Depois de criar a campanha, você poderá criar disparos de WhatsApp vinculados a ela direto do painel dela."}
            </p>
          </Secao>
        );
      case 6:
        return (
          <Secao titulo="Metas (opcional)">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {METAS_CAMPOS.map(({ campo, label }) => (
                <Campo key={campo} label={label}>
                  <input
                    type="number"
                    min={0}
                    value={metas[campo] ?? ""}
                    onChange={(e) => setMetas((atual) => ({ ...atual, [campo]: e.target.value }))}
                    className={campoClasses}
                  />
                </Campo>
              ))}
            </div>
          </Secao>
        );
      case 7:
        return (
          <Secao titulo="Tracking e mídia paga (opcional)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Domínio"><input type="text" value={dominio} onChange={(e) => setDominio(e.target.value)} className={campoClasses} /></Campo>
              <Campo label="Slug"><input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className={campoClasses} /></Campo>
              <Campo label="UTM Source"><input type="text" value={utmSource} onChange={(e) => setUtmSource(e.target.value)} className={campoClasses} /></Campo>
              <Campo label="UTM Medium"><input type="text" value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} className={campoClasses} /></Campo>
              <Campo label="UTM Campaign"><input type="text" value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} className={campoClasses} /></Campo>
              <Campo label="UTM Content"><input type="text" value={utmContent} onChange={(e) => setUtmContent(e.target.value)} className={campoClasses} /></Campo>
              <Campo label="UTM Term"><input type="text" value={utmTerm} onChange={(e) => setUtmTerm(e.target.value)} className={campoClasses} /></Campo>
            </div>
            <div className="grid grid-cols-1 gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-2">
              <Campo label="Meta Ads Campaign ID"><input type="text" value={metaAdsCampaignId} onChange={(e) => setMetaAdsCampaignId(e.target.value)} className={campoClasses} /></Campo>
              <Campo label="Google Ads Campaign ID"><input type="text" value={googleAdsCampaignId} onChange={(e) => setGoogleAdsCampaignId(e.target.value)} className={campoClasses} /></Campo>
              <Campo label="Investimento planejado (R$)"><input type="number" min={0} value={investimentoPlanejado} onChange={(e) => setInvestimentoPlanejado(e.target.value)} className={campoClasses} /></Campo>
              <Campo label="Investimento real (R$)"><input type="number" min={0} value={investimentoReal} onChange={(e) => setInvestimentoReal(e.target.value)} className={campoClasses} /></Campo>
            </div>
          </Secao>
        );
      case 8:
      default:
        return (
          <Secao titulo="Revisão">
            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-neutral-50 p-3 text-sm">
              <div><dt className="text-neutral-500">Nome</dt><dd className="font-medium text-neutral-900">{nome || "—"}</dd></div>
              <div><dt className="text-neutral-500">Objetivo</dt><dd className="font-medium text-neutral-900">{objetivo === "outro" ? objetivoOutro : OBJETIVOS_CAMPANHA.find((o) => o.valor === objetivo)?.label}</dd></div>
              <div><dt className="text-neutral-500">Tipo</dt><dd className="font-medium text-neutral-900">{tipo === "outro" ? tipoOutro : TIPOS_CAMPANHA.find((t) => t.valor === tipo)?.label}</dd></div>
              <div><dt className="text-neutral-500">Especialidade</dt><dd className="font-medium text-neutral-900">{especialidade || "—"}</dd></div>
              <div><dt className="text-neutral-500">Público</dt><dd className="font-medium text-neutral-900">{audienciaModo === "nenhuma" ? "Nenhuma" : audienciaModo === "existente" ? audiencias.find((a) => a.id === audienciaId)?.nome ?? "—" : "Filtro personalizado"}</dd></div>
              <div><dt className="text-neutral-500">Canais</dt><dd className="font-medium text-neutral-900">{canais.length ? canais.join(", ") : "—"}</dd></div>
              <div><dt className="text-neutral-500">Período</dt><dd className="font-medium text-neutral-900">{dataInicio || "—"} a {dataFim || "—"}</dd></div>
              <div><dt className="text-neutral-500">Agente de IA</dt><dd className="font-medium text-neutral-900">{agentes.find((a) => a.id === agenteIaId)?.nome ?? "—"}</dd></div>
            </dl>
            {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
          </Secao>
        );
    }
  }

  if (modo === "edicao") {
    return (
      <div className="space-y-4">
        <nav className="flex flex-wrap gap-1 border-b border-neutral-200">
          {TITULOS.map((titulo, i) => (
            <button
              key={titulo}
              type="button"
              onClick={() => setSecaoAtual(i + 1)}
              className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                secaoAtual === i + 1 ? "border-teal-700 text-teal-700" : "border-transparent text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {titulo}
            </button>
          ))}
        </nav>
        {renderSecao(secaoAtual)}
        {erro && secaoAtual !== 8 && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-neutral-400">
        Passo {secaoAtual} de {TITULOS.length} · {TITULOS[secaoAtual - 1]}
      </p>
      {renderSecao(secaoAtual)}
      <div className="mt-4 flex justify-between">
        <button
          type="button"
          onClick={() => setSecaoAtual((s) => Math.max(1, s - 1))}
          disabled={secaoAtual === 1}
          className="text-sm font-medium text-neutral-500 hover:text-neutral-700 disabled:opacity-40"
        >
          Voltar
        </button>
        {secaoAtual < TITULOS.length ? (
          <button
            type="button"
            onClick={() => setSecaoAtual((s) => Math.min(TITULOS.length, s + 1))}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white"
          >
            Próximo
          </button>
        ) : (
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {salvando ? "Criando…" : "Criar campanha"}
          </button>
        )}
      </div>
    </div>
  );
}
