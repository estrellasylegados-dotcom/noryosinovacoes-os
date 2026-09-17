"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Audiencia, FiltroAudiencia, ResultadoPublico } from "@/lib/audiencias";
import type { MensagemSalva } from "@/lib/mensagens-salvas";
import type { Etiqueta } from "@/lib/etiquetas";
import { STATUS_CONFIG, STATUS_ORDEM, type StatusConversa } from "@/lib/status";

/**
 * Wizard de 3 passos (público → mensagem → revisão) pro módulo Disparos —
 * Fase B. Só importa tipo (`import type`) de `audiencias.ts`/`mensagens-salvas.ts`:
 * esses arquivos também exportam função que fala com o Supabase server-side
 * (service role key), que nunca pode entrar no bundle do navegador — por
 * isso toda leitura/gravação de verdade passa por `/api/disparos/*`, nunca
 * por importar a lib direto aqui.
 */

type Props = {
  audiencias: Audiencia[];
  mensagensSalvas: MensagemSalva[];
  etiquetas: Etiqueta[];
  /** Preenchidos quando o disparo nasce de dentro de uma campanha estratégica (Ferramentas → Campanhas). */
  campanhaId?: string | null;
  audienciaPadraoId?: string | null;
};

type Passo = 1 | 2 | 3;

export function DisparosWizard({ audiencias, mensagensSalvas, etiquetas, campanhaId = null, audienciaPadraoId = null }: Props) {
  const router = useRouter();
  const [passo, setPasso] = useState<Passo>(1);

  const audienciaInicial =
    (audienciaPadraoId && audiencias.some((a) => a.id === audienciaPadraoId) ? audienciaPadraoId : null) ??
    audiencias[0]?.id ??
    null;

  // Passo 1 — público
  const [modoPublico, setModoPublico] = useState<"audiencia" | "filtro">(audiencias.length > 0 ? "audiencia" : "filtro");
  const [audienciaId, setAudienciaId] = useState<string | null>(audienciaInicial);
  const [etiquetaIds, setEtiquetaIds] = useState<string[]>([]);
  const [etiquetaModo, setEtiquetaModo] = useState<"todas" | "qualquer">("qualquer");
  const [statusSelecionados, setStatusSelecionados] = useState<StatusConversa[]>([]);
  const [inativoHaDias, setInativoHaDias] = useState("");
  const [preview, setPreview] = useState<ResultadoPublico | null>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [erroPreview, setErroPreview] = useState<string | null>(null);

  // Passo 2 — mensagem
  const [modoMensagem, setModoMensagem] = useState<"salva" | "nova">(mensagensSalvas.length > 0 ? "salva" : "nova");
  const [mensagemSalvaId, setMensagemSalvaId] = useState<string | null>(mensagensSalvas[0]?.id ?? null);
  const [textoNovo, setTextoNovo] = useState("");
  const [salvarComoMensagemSalva, setSalvarComoMensagemSalva] = useState(false);
  const [nomeNovaMensagem, setNomeNovaMensagem] = useState("");
  const [previewMensagem, setPreviewMensagem] = useState<string | null>(null);

  // Passo 3 — revisão
  const [nomeDisparo, setNomeDisparo] = useState("");
  const [enviando, setEnviando] = useState<"rascunho" | "iniciar" | null>(null);
  const [erroFinal, setErroFinal] = useState<string | null>(null);

  const filtroAtual: FiltroAudiencia = useMemo(() => {
    if (modoPublico === "audiencia") {
      return audiencias.find((a) => a.id === audienciaId)?.filtro ?? {};
    }
    return {
      etiquetaIds: etiquetaIds.length > 0 ? etiquetaIds : undefined,
      etiquetaModo: etiquetaIds.length > 1 ? etiquetaModo : undefined,
      statusConversa: statusSelecionados.length > 0 ? statusSelecionados : undefined,
      inativoHaDias: inativoHaDias.trim() ? Number(inativoHaDias) : undefined,
    };
  }, [modoPublico, audienciaId, audiencias, etiquetaIds, etiquetaModo, statusSelecionados, inativoHaDias]);

  const mensagemAtual = modoMensagem === "salva" ? mensagensSalvas.find((m) => m.id === mensagemSalvaId)?.conteudo ?? "" : textoNovo;

  function toggleEtiqueta(id: string) {
    setEtiquetaIds((atual) => (atual.includes(id) ? atual.filter((e) => e !== id) : [...atual, id]));
    setPreview(null);
  }

  function toggleStatus(status: StatusConversa) {
    setStatusSelecionados((atual) => (atual.includes(status) ? atual.filter((s) => s !== status) : [...atual, status]));
    setPreview(null);
  }

  async function calcularPublico() {
    setCarregandoPreview(true);
    setErroPreview(null);
    try {
      const res = await fetch("/api/disparos/preview-audiencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filtro: filtroAtual }),
      });
      const corpo = await res.json();
      if (!corpo.ok) {
        setErroPreview("Não consegui calcular o público agora.");
        return;
      }
      setPreview(corpo.resultado as ResultadoPublico);
    } catch {
      setErroPreview("Não consegui calcular o público agora.");
    } finally {
      setCarregandoPreview(false);
    }
  }

  async function calcularPreviewMensagem() {
    const exemplo = preview?.elegiveis[0];
    try {
      const res = await fetch("/api/disparos/preview-mensagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: mensagemAtual,
          nome: exemplo?.nome ?? "Paciente Exemplo",
          telefone: exemplo?.telefone ?? null,
        }),
      });
      const corpo = await res.json();
      if (corpo.ok) setPreviewMensagem(corpo.preview as string);
    } catch {
      // é só uma prévia — sem preview, o texto cru já aparece na tela
    }
  }

  async function finalizar(iniciarAgora: boolean) {
    const nome = nomeDisparo.trim();
    const texto = mensagemAtual.trim();
    if (!nome || !texto) {
      setErroFinal("Preencha o nome do disparo e a mensagem.");
      return;
    }
    if (modoMensagem === "nova" && salvarComoMensagemSalva && !nomeNovaMensagem.trim()) {
      setErroFinal("Dê um nome pra mensagem salva, ou desmarque a opção de salvar.");
      return;
    }

    setEnviando(iniciarAgora ? "iniciar" : "rascunho");
    setErroFinal(null);

    try {
      let mensagemSalvaIdFinal = modoMensagem === "salva" ? mensagemSalvaId : null;

      if (modoMensagem === "nova" && salvarComoMensagemSalva) {
        const resSalva = await fetch("/api/disparos/mensagens-salvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: nomeNovaMensagem.trim(), conteudo: texto }),
        });
        const corpoSalva = await resSalva.json();
        if (corpoSalva.ok) mensagemSalvaIdFinal = corpoSalva.id;
      }

      const res = await fetch("/api/disparos/lotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          filtro: filtroAtual,
          audienciaId: modoPublico === "audiencia" ? audienciaId : null,
          mensagemSalvaId: mensagemSalvaIdFinal,
          mensagemTexto: texto,
          iniciarAgora,
          campanhaId,
        }),
      });
      const corpo = await res.json();
      if (!corpo.ok) {
        setErroFinal(
          corpo.error === "sem_destinatarios"
            ? "Esse público não tem ninguém elegível pra receber mensagem agora."
            : "Não consegui criar o disparo agora."
        );
        return;
      }
      router.push(`/disparos/${corpo.id}`);
    } catch {
      setErroFinal("Não consegui criar o disparo agora.");
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <p className="mb-4 text-xs font-medium uppercase tracking-wide text-neutral-400">
        Passo {passo} de 3 · {passo === 1 ? "Público" : passo === 2 ? "Mensagem" : "Revisão"}
      </p>

      {passo === 1 && (
        <div className="space-y-4">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={modoPublico === "audiencia"}
                onChange={() => {
                  setModoPublico("audiencia");
                  setPreview(null);
                }}
                disabled={audiencias.length === 0}
              />
              Audiência salva
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={modoPublico === "filtro"}
                onChange={() => {
                  setModoPublico("filtro");
                  setPreview(null);
                }}
              />
              Montar agora
            </label>
          </div>

          {modoPublico === "audiencia" ? (
            audiencias.length === 0 ? (
              <p className="text-sm text-neutral-400">Nenhuma audiência salva ainda — use &quot;Montar agora&quot;.</p>
            ) : (
              <select
                value={audienciaId ?? ""}
                onChange={(e) => {
                  setAudienciaId(e.target.value);
                  setPreview(null);
                }}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                {audiencias.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} {a.ultimaContagem !== null ? `(~${a.ultimaContagem} contato(s))` : ""}
                  </option>
                ))}
              </select>
            )
          ) : (
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
                          etiquetaIds.includes(et.id)
                            ? "bg-teal-700 text-white ring-teal-700"
                            : "text-neutral-600 ring-neutral-200 hover:bg-neutral-50"
                        }`}
                      >
                        {et.nome}
                      </button>
                    ))}
                  </div>
                  {etiquetaIds.length > 1 && (
                    <div className="mt-2 flex gap-4 text-xs text-neutral-600">
                      <label className="flex items-center gap-1.5">
                        <input type="radio" checked={etiquetaModo === "qualquer"} onChange={() => setEtiquetaModo("qualquer")} />
                        Qualquer uma
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="radio" checked={etiquetaModo === "todas"} onChange={() => setEtiquetaModo("todas")} />
                        Todas
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
                        statusSelecionados.includes(s)
                          ? "bg-teal-700 text-white ring-teal-700"
                          : "text-neutral-600 ring-neutral-200 hover:bg-neutral-50"
                      }`}
                    >
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-500">Inativo há pelo menos (dias)</label>
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
              </div>
            </div>
          )}

          <div className="border-t border-neutral-100 pt-3">
            <button
              type="button"
              onClick={calcularPublico}
              disabled={carregandoPreview}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
            >
              {carregandoPreview ? "Calculando…" : "Calcular público"}
            </button>

            {erroPreview && <p className="mt-2 text-sm text-red-600">{erroPreview}</p>}

            {preview && (
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <span>
                  <strong className="text-neutral-900">{preview.totalEncontrados}</strong>{" "}
                  <span className="text-neutral-500">encontrado(s)</span>
                </span>
                <span>
                  <strong className="text-amber-700">{preview.excluidos.length}</strong>{" "}
                  <span className="text-neutral-500">excluído(s) (opt-out/telefone)</span>
                </span>
                <span>
                  <strong className="text-emerald-700">{preview.elegiveis.length}</strong>{" "}
                  <span className="text-neutral-500">elegível(is)</span>
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end border-t border-neutral-100 pt-4">
            <button
              type="button"
              onClick={() => setPasso(2)}
              disabled={!preview || preview.elegiveis.length === 0}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Próximo
            </button>
          </div>
        </div>
      )}

      {passo === 2 && (
        <div className="space-y-4">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={modoMensagem === "salva"}
                onChange={() => {
                  setModoMensagem("salva");
                  setPreviewMensagem(null);
                }}
                disabled={mensagensSalvas.length === 0}
              />
              Mensagem salva
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={modoMensagem === "nova"}
                onChange={() => {
                  setModoMensagem("nova");
                  setPreviewMensagem(null);
                }}
              />
              Escrever agora
            </label>
          </div>

          {modoMensagem === "salva" ? (
            mensagensSalvas.length === 0 ? (
              <p className="text-sm text-neutral-400">Nenhuma mensagem salva ainda — use &quot;Escrever agora&quot;.</p>
            ) : (
              <select
                value={mensagemSalvaId ?? ""}
                onChange={(e) => {
                  setMensagemSalvaId(e.target.value);
                  setPreviewMensagem(null);
                }}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                {mensagensSalvas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            )
          ) : (
            <div className="space-y-2">
              <textarea
                value={textoNovo}
                onChange={(e) => {
                  setTextoNovo(e.target.value);
                  setPreviewMensagem(null);
                }}
                rows={4}
                placeholder="Oi {primeiro_nome}, tudo bem? ..."
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
              <p className="text-xs text-neutral-400">Variáveis disponíveis: {"{nome}"}, {"{primeiro_nome}"}, {"{telefone}"}</p>

              <label className="flex items-center gap-2 text-sm text-neutral-600">
                <input
                  type="checkbox"
                  checked={salvarComoMensagemSalva}
                  onChange={(e) => setSalvarComoMensagemSalva(e.target.checked)}
                />
                Salvar esta mensagem pra reusar depois
              </label>
              {salvarComoMensagemSalva && (
                <input
                  type="text"
                  value={nomeNovaMensagem}
                  onChange={(e) => setNomeNovaMensagem(e.target.value)}
                  placeholder="Nome da mensagem salva"
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                />
              )}
            </div>
          )}

          <div className="border-t border-neutral-100 pt-3">
            <button
              type="button"
              onClick={calcularPreviewMensagem}
              disabled={!mensagemAtual.trim()}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
            >
              Ver preview
            </button>
            {previewMensagem && <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">{previewMensagem}</p>}
          </div>

          <div className="flex justify-between border-t border-neutral-100 pt-4">
            <button type="button" onClick={() => setPasso(1)} className="text-sm font-medium text-neutral-500 hover:text-neutral-700">
              Voltar
            </button>
            <button
              type="button"
              onClick={() => setPasso(3)}
              disabled={!mensagemAtual.trim()}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Próximo
            </button>
          </div>
        </div>
      )}

      {passo === 3 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-500">Nome do disparo</label>
            <input
              type="text"
              value={nomeDisparo}
              onChange={(e) => setNomeDisparo(e.target.value)}
              placeholder="ex.: Reativação — inativos 60 dias"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
          </div>

          <dl className="grid grid-cols-2 gap-3 rounded-lg bg-neutral-50 p-3 text-sm">
            <div>
              <dt className="text-neutral-500">Destinatários elegíveis</dt>
              <dd className="font-medium text-neutral-900">{preview?.elegiveis.length ?? 0}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Público</dt>
              <dd className="font-medium text-neutral-900">
                {modoPublico === "audiencia" ? audiencias.find((a) => a.id === audienciaId)?.nome ?? "—" : "Filtro personalizado"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-neutral-500">Mensagem</dt>
              <dd className="mt-1 whitespace-pre-wrap font-medium text-neutral-900">{mensagemAtual}</dd>
            </div>
          </dl>

          {erroFinal && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erroFinal}</p>}

          <div className="flex flex-wrap justify-between gap-2 border-t border-neutral-100 pt-4">
            <button type="button" onClick={() => setPasso(2)} className="text-sm font-medium text-neutral-500 hover:text-neutral-700">
              Voltar
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => finalizar(false)}
                disabled={enviando !== null}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
              >
                {enviando === "rascunho" ? "Salvando…" : "Salvar rascunho"}
              </button>
              <button
                type="button"
                onClick={() => finalizar(true)}
                disabled={enviando !== null}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {enviando === "iniciar" ? "Criando…" : "Criar e iniciar agora"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
