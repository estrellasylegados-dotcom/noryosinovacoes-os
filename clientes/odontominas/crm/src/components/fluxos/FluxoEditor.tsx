"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  adicionarNo,
  aplicarConexao,
  atualizarNo,
  criarNoPadrao,
  limparConectorOpcional,
  removerNo,
} from "@/lib/fluxo-editor-grafo";
import { atualizarPosicaoNo, gerarLayoutAutomatico, lerLayoutEditor, escreverLayoutEditor, type PosicaoNo } from "@/lib/fluxo-editor-layout";
import { validarGrafo } from "@/lib/fluxo-validador";
import type { FluxoDefinicao, NoFluxo } from "@/lib/fluxo-tipos";
import type { ExecucaoFluxoResumo } from "@/lib/fluxo-execucoes-consulta";
import type { FluxoParaEditor, StatusVersaoFluxo } from "@/lib/fluxo-versoes";
import type { Etiqueta } from "@/lib/etiquetas";
import type { Atendente } from "@/lib/atendentes";
import type { AgenteIA } from "@/lib/agentes";
import { FluxoBarraAcoes } from "@/components/fluxos/FluxoBarraAcoes";
import { FluxoCanvas } from "@/components/fluxos/FluxoCanvas";
import { FluxoPaletaBlocos } from "@/components/fluxos/FluxoPaletaBlocos";
import { FluxoPainelPropriedades } from "@/components/fluxos/FluxoPainelPropriedades";
import { FluxoPainelTeste } from "@/components/fluxos/FluxoPainelTeste";
import { FluxoPainelValidacao } from "@/components/fluxos/FluxoPainelValidacao";
import { FluxoHistoricoExecucoes } from "@/components/fluxos/FluxoHistoricoExecucoes";

const LIMITE_HISTORICO = 50;
const DEBOUNCE_RASCUNHO_MS = 1500;
const DEBOUNCE_NOME_MS = 1000;

function gerarIdNo(): string {
  return `no_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

type GatilhoBruto = { tipo?: unknown; config?: unknown };

function lerGatilho(config: Record<string, unknown>): { tipo: string; palavras: string } {
  const bruto = config.gatilho as GatilhoBruto | undefined;
  const tipo = typeof bruto?.tipo === "string" && bruto.tipo ? bruto.tipo : "manual";
  const configBruta = bruto?.config && typeof bruto.config === "object" ? (bruto.config as Record<string, unknown>) : {};
  const palavras = Array.isArray(configBruta.palavras) ? (configBruta.palavras as unknown[]).filter((p) => typeof p === "string") : [];
  return { tipo, palavras: (palavras as string[]).join(", ") };
}

export function FluxoEditor({
  fluxo,
  execucoesTesteIniciais,
  execucoesReaisIniciais,
  controleOdontoConfigurado,
  etiquetas,
  atendentes,
  agentes,
  podePublicar,
  podeVerExecucoes,
}: {
  fluxo: FluxoParaEditor;
  execucoesTesteIniciais: ExecucaoFluxoResumo[];
  execucoesReaisIniciais: ExecucaoFluxoResumo[];
  controleOdontoConfigurado: boolean;
  etiquetas: Etiqueta[];
  atendentes: Atendente[];
  agentes: AgenteIA[];
  podePublicar: boolean;
  podeVerExecucoes: boolean;
}) {
  const router = useRouter();

  const [definicao, setDefinicaoInterno] = useState<FluxoDefinicao>(fluxo.definicao);
  const [passado, setPassado] = useState<FluxoDefinicao[]>([]);
  const [futuro, setFuturo] = useState<FluxoDefinicao[]>([]);
  const definicaoRef = useRef(definicao);
  definicaoRef.current = definicao;

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [noEmExecucaoId, setNoEmExecucaoId] = useState<string | null>(null);

  const [versaoNumero, setVersaoNumero] = useState(fluxo.versaoNumero);
  const [versaoStatus, setVersaoStatus] = useState<StatusVersaoFluxo>(fluxo.versaoStatus);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState(false);
  const [ultimoSalvoEm, setUltimoSalvoEm] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [erroPublicar, setErroPublicar] = useState<string | null>(null);
  const [validacaoServidor, setValidacaoServidor] = useState<string | null>(null);
  const [nome, setNome] = useState(fluxo.nome);

  /** Commit = ponto de undo — nunca por keystroke, só em ações discretas (fim de drag, blur, add/remove nó, conectar). */
  const commit = useCallback((nova: FluxoDefinicao) => {
    setPassado((p) => [...p.slice(-(LIMITE_HISTORICO - 1)), definicaoRef.current]);
    setFuturo([]);
    setDefinicaoInterno(nova);
  }, []);

  const desfazer = useCallback(() => {
    setPassado((p) => {
      if (p.length === 0) return p;
      const anterior = p[p.length - 1];
      setFuturo((f) => [definicaoRef.current, ...f]);
      setDefinicaoInterno(anterior);
      return p.slice(0, -1);
    });
  }, []);

  const refazer = useCallback(() => {
    setFuturo((f) => {
      if (f.length === 0) return f;
      const proximo = f[0];
      setPassado((p) => [...p, definicaoRef.current]);
      setDefinicaoInterno(proximo);
      return f.slice(1);
    });
  }, []);

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      const alvo = document.activeElement;
      const emCampo = alvo instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName);
      if (emCampo) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        desfazer();
      } else if ((event.key.toLowerCase() === "z" && event.shiftKey) || event.key.toLowerCase() === "y") {
        event.preventDefault();
        refazer();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [desfazer, refazer]);

  const grafo = useMemo(() => validarGrafo(definicao), [definicao]);
  const problemasPorNo = useMemo(() => {
    const mapa = new Map<string, "erro" | "aviso">();
    for (const problema of grafo.avisos) for (const id of problema.noIds) if (!mapa.has(id)) mapa.set(id, "aviso");
    for (const problema of grafo.erros) for (const id of problema.noIds) mapa.set(id, "erro");
    return mapa;
  }, [grafo]);

  const layout = useMemo(() => lerLayoutEditor(definicao.config), [definicao]);
  const noSelecionado = useMemo(() => definicao.nodes.find((n) => n.id === selecionadoId) ?? null, [definicao, selecionadoId]);
  const { tipo: gatilhoTipo, palavras: gatilhoPalavras } = useMemo(() => lerGatilho(definicao.config), [definicao]);

  // --- Autosave do rascunho ---------------------------------------------
  const timeoutRascunhoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primeiraExecucaoRascunhoRef = useRef(true);

  const salvarRascunhoAgora = useCallback(
    async (def: FluxoDefinicao) => {
      setSalvando(true);
      try {
        const resposta = await fetch(`/api/fluxos/${fluxo.id}/rascunho`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ definicao: def }),
        });
        const resultado = (await resposta.json()) as { ok: boolean; numero?: number };
        if (!resultado.ok) {
          setErroSalvar(true);
          throw new Error("rascunho_nao_salvo");
        }
        setErroSalvar(false);
        setUltimoSalvoEm(new Date().toISOString());
        if (resultado.numero !== undefined) setVersaoNumero(resultado.numero);
        setVersaoStatus("rascunho");
      } catch {
        setErroSalvar(true);
        throw new Error("rascunho_nao_salvo");
      } finally {
        setSalvando(false);
      }
    },
    [fluxo.id]
  );

  const flushRascunho = useCallback(async () => {
    if (timeoutRascunhoRef.current) {
      clearTimeout(timeoutRascunhoRef.current);
      timeoutRascunhoRef.current = null;
    }
    await salvarRascunhoAgora(definicaoRef.current);
  }, [salvarRascunhoAgora]);

  useEffect(() => {
    if (primeiraExecucaoRascunhoRef.current) {
      primeiraExecucaoRascunhoRef.current = false;
      return;
    }
    if (timeoutRascunhoRef.current) clearTimeout(timeoutRascunhoRef.current);
    timeoutRascunhoRef.current = setTimeout(() => void salvarRascunhoAgora(definicao).catch(() => undefined), DEBOUNCE_RASCUNHO_MS);
    return () => {
      if (timeoutRascunhoRef.current) clearTimeout(timeoutRascunhoRef.current);
    };
  }, [definicao, salvarRascunhoAgora]);

  // --- Autosave do nome (metadado fora do jsonb versionado) --------------
  const timeoutNomeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const primeiraExecucaoNomeRef = useRef(true);
  useEffect(() => {
    if (primeiraExecucaoNomeRef.current) {
      primeiraExecucaoNomeRef.current = false;
      return;
    }
    if (timeoutNomeRef.current) clearTimeout(timeoutNomeRef.current);
    timeoutNomeRef.current = setTimeout(() => {
      const limpo = nome.trim();
      if (!limpo) return;
      void fetch(`/api/fluxos/${fluxo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: limpo }),
      });
    }, DEBOUNCE_NOME_MS);
    return () => {
      if (timeoutNomeRef.current) clearTimeout(timeoutNomeRef.current);
    };
  }, [nome, fluxo.id]);

  // --- Edição do grafo -----------------------------------------------------
  const onAtualizarNo = useCallback((no: NoFluxo) => commit({ ...definicaoRef.current, nodes: atualizarNo(definicaoRef.current.nodes, no.id, no) }), [commit]);

  const onDeletarNo = useCallback(
    (id: string) => {
      commit({ ...definicaoRef.current, nodes: removerNo(definicaoRef.current.nodes, id) });
      setSelecionadoId((atual) => (atual === id ? null : atual));
    },
    [commit]
  );

  const onConectar = useCallback(
    (source: string, sourceHandle: string, target: string) =>
      commit({ ...definicaoRef.current, nodes: aplicarConexao(definicaoRef.current.nodes, source, sourceHandle, target) }),
    [commit]
  );

  const onDeletarAresta = useCallback(
    (noId: string, sourceHandle: string) => {
      const no = definicaoRef.current.nodes.find((n) => n.id === noId);
      if (!no) return;
      commit({ ...definicaoRef.current, nodes: atualizarNo(definicaoRef.current.nodes, noId, limparConectorOpcional(no, sourceHandle)) });
    },
    [commit]
  );

  const onSoltarBloco = useCallback(
    (tipo: NoFluxo["tipo"], posicao: PosicaoNo) => {
      if (tipo === "inicio") return;
      const id = gerarIdNo();
      const novoNo = criarNoPadrao(tipo, id);
      const novoLayout = atualizarPosicaoNo(lerLayoutEditor(definicaoRef.current.config), id, posicao);
      commit({
        ...definicaoRef.current,
        nodes: adicionarNo(definicaoRef.current.nodes, novoNo),
        config: escreverLayoutEditor(definicaoRef.current.config, novoLayout),
      });
      setSelecionadoId(id);
    },
    [commit]
  );

  const onMoverNo = useCallback(
    (id: string, posicao: PosicaoNo) => {
      const novoLayout = atualizarPosicaoNo(lerLayoutEditor(definicaoRef.current.config), id, posicao);
      commit({ ...definicaoRef.current, config: escreverLayoutEditor(definicaoRef.current.config, novoLayout) });
    },
    [commit]
  );

  const onOrganizarAutomaticamente = useCallback(() => {
    const posicoes = gerarLayoutAutomatico(definicaoRef.current.nodes);
    commit({ ...definicaoRef.current, config: escreverLayoutEditor(definicaoRef.current.config, { posicoes }) });
  }, [commit]);

  const onMudarGatilho = useCallback(
    (tipo: string, palavrasTexto: string, comercialConfig?: Record<string, unknown>) => {
      const palavras = palavrasTexto
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const gatilhoConfig = comercialConfig ?? (tipo === "kanban_stage_changed" ? { modo: "entrada", pipelineId: "", etapaId: "", tempoSegundos: 86400, reentrada: "por_entrada", pararAoSair: true, pararAoResponder: true, respeitarHorario: true } : tipo === "palavra_chave" ? { palavras } : {});
      commit({ ...definicaoRef.current, config: { ...definicaoRef.current.config, gatilho: { tipo, config: gatilhoConfig } } });
    },
    [commit]
  );

  const onSelecionarProblema = useCallback((noIds: string[]) => setSelecionadoId(noIds[0] ?? null), []);

  async function publicar() {
    setPublicando(true);
    setErroPublicar(null);
    try {
      await flushRascunho();
      const resposta = await fetch(`/api/fluxos/${fluxo.id}/publicar`, { method: "POST" });
      const resultado = (await resposta.json()) as { ok: boolean; error?: string };
      if (!resultado.ok) {
        setErroPublicar(
          resultado.error === "grafo_invalido" ? "Ainda há erros de validação — corrija antes de publicar." : "Não consegui publicar agora."
        );
        return;
      }
      setVersaoStatus("publicada");
      router.refresh();
    } catch {
      setErroPublicar("Não foi possível salvar e publicar. Confira a conexão e tente novamente.");
    } finally {
      setPublicando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <FluxoBarraAcoes
        nome={nome}
        onMudarNome={setNome}
        status={fluxo.status}
        versaoStatus={versaoStatus}
        versaoNumero={versaoNumero}
        salvando={salvando}
        erroSalvar={erroSalvar}
        ultimoSalvoEm={ultimoSalvoEm}
        podeDesfazer={passado.length > 0}
        podeRefazer={futuro.length > 0}
        onDesfazer={desfazer}
        onRefazer={refazer}
        podePublicar={podePublicar && grafo.erros.length === 0}
        publicando={publicando}
        onPublicar={publicar}
      />
      {erroPublicar && <p className="border-b border-red-100 bg-red-50 px-4 py-1.5 text-xs text-red-700">{erroPublicar}</p>}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <FluxoPaletaBlocos controleOdontoConfigurado={controleOdontoConfigurado} />

        <div className="relative min-h-[420px] min-w-0 flex-1">
          <button
            type="button"
            onClick={onOrganizarAutomaticamente}
            className="absolute right-3 top-3 z-10 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-600 shadow-sm hover:bg-neutral-50"
          >
            Organizar automaticamente
          </button>
          <FluxoCanvas
            nodes={definicao.nodes}
            posicoes={layout.posicoes}
            selecionadoId={selecionadoId}
            problemasPorNo={problemasPorNo}
            noEmExecucaoId={noEmExecucaoId}
            etiquetas={etiquetas}
            atendentes={atendentes}
            agentes={agentes}
            onSelecionar={setSelecionadoId}
            onMoverNo={onMoverNo}
            onConectar={onConectar}
            onDeletarAresta={onDeletarAresta}
            onDeletarNo={onDeletarNo}
            onSoltarBloco={onSoltarBloco}
          />
        </div>

        <div className="w-full shrink-0 overflow-y-auto border-l border-neutral-200 bg-white lg:w-80">
          {podeVerExecucoes && <FluxoHistoricoExecucoes execucoes={execucoesReaisIniciais} />}
          <div className="border-b border-neutral-200 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Validação</p>
            <FluxoPainelValidacao erros={grafo.erros} avisos={grafo.avisos} onSelecionarProblema={onSelecionarProblema} />
            <button type="button" className="mt-3 rounded-lg border border-teal-700 px-3 py-2 text-sm text-teal-800" onClick={async()=>{
              setValidacaoServidor("Validando…");
              try { await flushRascunho(); const r=await fetch(`/api/fluxos/${fluxo.id}/validar`,{method:"POST"}); const j=await r.json();
                setValidacaoServidor(j.ok ? "Fluxo válido. Nenhuma mensagem foi enviada." : "Revise o gatilho, as referências da clínica e os erros de validação antes de publicar.");
              } catch { setValidacaoServidor("Não foi possível validar agora. Confira a conexão."); }
            }}>Validar sem enviar</button>
            {validacaoServidor && <p role="status" className="mt-2 text-xs text-neutral-600">{validacaoServidor}</p>}
          </div>
          <div className="border-b border-neutral-200 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Testar</p>
            {gatilhoTipo === "kanban_stage_changed" ? <p className="text-xs text-neutral-600">Valide sem enviar acima. O teste completo usa uma oportunidade identificada como TESTE, pelo Kanban, em ambiente controlado.</p> : podeVerExecucoes && <FluxoPainelTeste
              fluxoId={fluxo.id}
              bloqueadoPorErro={grafo.erros.length > 0}
              historicoInicial={execucoesTesteIniciais}
              onFlushAutosave={flushRascunho}
              onExecucaoNoAtualChange={setNoEmExecucaoId}
            />}
          </div>
          <FluxoPainelPropriedades
            noSelecionado={noSelecionado}
            onAtualizarNo={onAtualizarNo}
            gatilhoTipo={gatilhoTipo}
            gatilhoPalavras={gatilhoPalavras}
            gatilhoConfig={(definicao.config.gatilho as { config?: Record<string, unknown> } | undefined)?.config ?? {}}
            onMudarGatilho={onMudarGatilho}
            etiquetas={etiquetas}
            atendentes={atendentes}
            agentes={agentes}
          />
        </div>
      </div>
    </div>
  );
}
