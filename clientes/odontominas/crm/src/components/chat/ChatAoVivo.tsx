"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import type { Atendente } from "@/lib/atendentes";
import {
  contarAbasChat,
  filtrarConversasChat,
  ordenarConversasChat,
  type AbaChat,
  type ConversaChat,
  type MensagemChat,
  type OrdemChat,
} from "@/lib/chat-filtros";
import type { Etiqueta } from "@/lib/etiquetas";
import { PRIORIDADE_CONFIG, PRIORIDADE_ORDEM, type Prioridade } from "@/lib/prioridade";
import { STATUS_CONFIG, STATUS_ORDEM, type StatusConversa } from "@/lib/status";
import { formatHoraCurta, formatTelefone } from "@/lib/tempo";
import type { StatusSlaConversa } from "@/lib/sla";
import { NotasInternas } from "@/components/chat/NotasInternas";
import { rankSla, SlaBadge } from "@/components/chat/SlaBadge";

const INTERVALO_LISTA_MS = 8000;
const INTERVALO_THREAD_MS = 4000;
const INTERVALO_SLA_MS = 15000;

type FiltroSla = "" | "ok" | "warning" | "breached" | "paused" | "sem_configuracao";

const OPCOES_FILTRO_SLA: { valor: FiltroSla; label: string }[] = [
  { valor: "", label: "Todos" },
  { valor: "ok", label: "Dentro do SLA" },
  { valor: "warning", label: "Próximo do limite" },
  { valor: "breached", label: "Fora do SLA" },
  { valor: "paused", label: "Fora do expediente" },
  { valor: "sem_configuracao", label: "Sem SLA configurado" },
];

/** `status.tipo` já é quase o valor do filtro — só "not_configured"/"sem_ciclo" (sem SLA aplicável) viram um filtro só. */
function statusBateComFiltro(status: StatusSlaConversa | undefined, filtro: FiltroSla): boolean {
  if (!filtro) return true;
  if (filtro === "sem_configuracao") return !status || status.tipo === "not_configured" || status.tipo === "sem_ciclo";
  return status?.tipo === filtro;
}
const CHAVE_LARGURA_LISTA = "chat-largura-lista";
const LARGURA_MIN = 280;
const LARGURA_MAX = 560;
const LARGURA_PADRAO = 360;
const CHAVE_SOM_NOTIFICACAO = "chat-som-notificacao";

/** Filas da caixa compartilhada (cada uma com contagem ao lado). "Meus" = atribuídos a mim. */
const OPCOES_FILA: { valor: Exclude<AbaChat, "arquivadas">; label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "novos", label: "Novos" },
  { valor: "sem_responsavel", label: "Sem responsável" },
  { valor: "atribuidos", label: "Meus" },
  { valor: "aguardando_atendente", label: "Aguardando atendente" },
  { valor: "aguardando_paciente", label: "Aguardando paciente" },
  { valor: "concluidos", label: "Finalizados" },
  { valor: "nao_lidas", label: "Não lidas" },
];

const OPCOES_ORDEM: { valor: OrdemChat; label: string }[] = [
  { valor: "recentes", label: "Mais recentes" },
  { valor: "antigos", label: "Mais antigos" },
  { valor: "sem_responsavel", label: "Sem responsável primeiro" },
];

export type CanalChat = { id: string; nome: string; ativo: boolean };

/** Quem está no controle AGORA (Humano, IA ou Fluxo) — um indicador só, pra ninguém confundir. */
function textoControle(c: ConversaChat): string {
  if (c.donoConversa === "fluxo") return "Automação ativa";
  if (c.donoConversa === "agente_ia" && c.agenteAtivoId) return "IA ativa";
  return c.atribuidoANome ? `Controle: ${c.atribuidoANome}` : "Sem responsável";
}

const CORES_AVATAR = ["bg-teal-600", "bg-blue-600", "bg-violet-600", "bg-rose-600", "bg-amber-600", "bg-emerald-600"];

function corAvatar(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return CORES_AVATAR[hash % CORES_AVATAR.length];
}

function iniciais(nome: string | null, telefone: string): string {
  if (nome) {
    const partes = nome.trim().split(/\s+/);
    return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
  }
  return telefone.slice(-2);
}

function Avatar({ nome, telefone }: { nome: string | null; telefone: string }) {
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${corAvatar(
        nome || telefone
      )}`}
    >
      {iniciais(nome, telefone)}
    </div>
  );
}

async function chamarApi<T = { ok: boolean; error?: string }>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const resposta = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  return (await resposta.json()) as T;
}

export function ChatAoVivo({
  conversasIniciais,
  etiquetasIniciais,
  etiquetasComAgente,
  atendentes,
  atendenteAtualId,
  clinicaNome,
  canais,
  permissoes,
}: {
  conversasIniciais: ConversaChat[];
  etiquetasIniciais: Etiqueta[];
  etiquetasComAgente: string[];
  atendentes: Atendente[];
  atendenteAtualId: string | null;
  /** Fase 3, branding dinâmico — client component, recebe via prop do Server Component pai (chat/page.tsx). */
  clinicaNome: string;
  /** Canais da clínica (nome amigável na lista e no cabeçalho; filtro por canal). */
  canais: CanalChat[];
  /** Permissões da sessão — só pra mostrar/esconder botão; o backend é quem autoriza de verdade. */
  permissoes: string[];
}) {
  const [conversas, setConversas] = useState(conversasIniciais);
  const [etiquetas, setEtiquetas] = useState(etiquetasIniciais);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaChat>("todos");
  const [busca, setBusca] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState<Prioridade | "">("");
  const [filtroEtiquetaId, setFiltroEtiquetaId] = useState("");
  const [filtroSla, setFiltroSla] = useState<FiltroSla>("");
  const [ordenarPorSla, setOrdenarPorSla] = useState(false);
  const [filtroCanalId, setFiltroCanalId] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [ordem, setOrdem] = useState<OrdemChat>("recentes");
  const [erroAtribuicao, setErroAtribuicao] = useState<string | null>(null);
  const [mostrarTransferir, setMostrarTransferir] = useState(false);
  const [slaPorConversa, setSlaPorConversa] = useState<Record<string, StatusSlaConversa>>({});

  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [carregandoMensagens, setCarregandoMensagens] = useState(false);
  const [textoResposta, setTextoResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const [mostrarNovaConversa, setMostrarNovaConversa] = useState(false);
  const [mostrarEtiquetaPopover, setMostrarEtiquetaPopover] = useState(false);
  const [novoNomeEtiqueta, setNovoNomeEtiqueta] = useState("");

  const fimDaThreadRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const arrastandoRef = useRef(false);
  const [larguraLista, setLarguraLista] = useState(LARGURA_PADRAO);

  const [somAtivo, setSomAtivo] = useState(true);
  const somAtivoRef = useRef(somAtivo);
  const audioContextRef = useRef<AudioContext | null>(null);

  const contagens = useMemo(() => contarAbasChat(conversas, atendenteAtualId), [conversas, atendenteAtualId]);
  const conversasFiltradas = useMemo(() => {
    const base = filtrarConversasChat(conversas, {
      aba,
      atendenteIdAtual: atendenteAtualId,
      prioridade: filtroPrioridade || null,
      etiquetaId: filtroEtiquetaId || null,
      busca,
      canalId: filtroCanalId || null,
      responsavelId: filtroResponsavel === "meus" ? atendenteAtualId : filtroResponsavel || null,
    }).filter((c) => statusBateComFiltro(slaPorConversa[c.id], filtroSla));

    const ordenada = ordenarConversasChat(base, ordem);
    if (!ordenarPorSla) return ordenada;
    return [...ordenada].sort((a, b) => rankSla(slaPorConversa[a.id]) - rankSla(slaPorConversa[b.id]));
  }, [conversas, aba, atendenteAtualId, filtroPrioridade, filtroEtiquetaId, busca, filtroSla, ordenarPorSla, slaPorConversa, filtroCanalId, filtroResponsavel, ordem]);

  const pode = (permissao: string) => permissoes.includes(permissao);
  const nomeCanal = (id: string | null) => canais.find((c) => c.id === id)?.nome ?? null;
  const varioscanais = canais.length > 1;
  const atendentesDestino = atendentes.filter((a) => a.status === "active" && a.perfil !== "noryos_admin" && a.perfil !== "noryos_suporte");

  const selecionada = conversas.find((c) => c.id === selecionadaId) ?? null;
  const podeResponderSelecionada =
    Boolean(selecionada) &&
    permissoes.includes("conversas.assumir") &&
    (!selecionada?.atribuidoAId || selecionada.atribuidoAId === atendenteAtualId || permissoes.includes("conversas.intervir"));

  // Toca só quando a lista de novo tem uma mensagem RECEBIDA mais recente que a
  // que já estava ali — nunca na carga inicial nem quando a mudança é o
  // próprio atendente enviando (evita "ding" pra ação da própria pessoa).
  function tocarSomNotificacao() {
    if (!somAtivoRef.current || typeof window === "undefined") return;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      if (!audioContextRef.current) audioContextRef.current = new Ctor();
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const agora = ctx.currentTime;
      const oscilador = ctx.createOscillator();
      const ganho = ctx.createGain();
      oscilador.type = "sine";
      oscilador.frequency.setValueAtTime(880, agora);
      oscilador.frequency.setValueAtTime(1175, agora + 0.09);
      ganho.gain.setValueAtTime(0, agora);
      ganho.gain.linearRampToValueAtTime(0.18, agora + 0.01);
      ganho.gain.exponentialRampToValueAtTime(0.001, agora + 0.28);
      oscilador.connect(ganho);
      ganho.connect(ctx.destination);
      oscilador.start(agora);
      oscilador.stop(agora + 0.3);
    } catch {
      // navegador sem suporte a Web Audio — silencioso, mesmo padrão da notificação do navegador.
    }
  }

  async function atualizarListaAgora() {
    const dados = await chamarApi<{ ok: boolean; conversas?: ConversaChat[] }>("/api/chat/conversas");
    if (!dados.ok || !dados.conversas) return;
    const conversasNovas = dados.conversas;
    setConversas((anterior) => {
      const porId = new Map(anterior.map((c) => [c.id, c]));
      const chegouMensagemNova = conversasNovas.some((c) => {
        if (c.ultimaMensagemDirecao !== "recebida") return false;
        const antes = porId.get(c.id);
        return antes ? antes.ultimaMensagemEm !== c.ultimaMensagemEm : true;
      });
      if (chegouMensagemNova) tocarSomNotificacao();
      return conversasNovas;
    });
  }

  // Lista: carga inicial já veio do servidor, então só faz polling a partir daqui.
  useEffect(() => {
    const id = setInterval(atualizarListaAgora, INTERVALO_LISTA_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function atualizarSlaAgora() {
      const dados = await chamarApi<{ ok: boolean; lista?: { conversaId: string; status: StatusSlaConversa }[] }>("/api/chat/sla/resumo");
      if (!dados.ok || !dados.lista) return;
      setSlaPorConversa(Object.fromEntries(dados.lista.map((item) => [item.conversaId, item.status])));
    }
    atualizarSlaAgora();
    const id = setInterval(atualizarSlaAgora, INTERVALO_SLA_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selecionadaId) {
      setMensagens([]);
      return;
    }

    let cancelado = false;
    async function carregar(mostrarLoading: boolean) {
      if (mostrarLoading) setCarregandoMensagens(true);
      const dados = await chamarApi<{ ok: boolean; mensagens?: MensagemChat[] }>(
        `/api/chat/conversas/${selecionadaId}/mensagens`
      );
      if (!cancelado && dados.ok && dados.mensagens) setMensagens(dados.mensagens);
      if (mostrarLoading) setCarregandoMensagens(false);
    }

    carregar(true);
    const id = setInterval(() => carregar(false), INTERVALO_THREAD_MS);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [selecionadaId]);

  useEffect(() => {
    fimDaThreadRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens, selecionadaId]);

  // Largura da lista à esquerda é arrastável (a pedido do Rafael, "tela estática" ->
  // ajustável) — carrega o valor salvo uma vez, só no cliente (evita divergir do SSR).
  useEffect(() => {
    const salva = localStorage.getItem(CHAVE_LARGURA_LISTA);
    const numero = salva ? parseInt(salva, 10) : NaN;
    if (!Number.isNaN(numero)) setLarguraLista(Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, numero)));
  }, []);

  // Preferência de som é por navegador/pessoa (igual notificacoes-preferencia.ts),
  // nunca por clínica — carrega uma vez, só no cliente.
  useEffect(() => {
    const salvo = localStorage.getItem(CHAVE_SOM_NOTIFICACAO);
    if (salvo !== null) setSomAtivo(salvo === "1");
  }, []);

  useEffect(() => {
    somAtivoRef.current = somAtivo;
  }, [somAtivo]);

  function alternarSom() {
    setSomAtivo((atual) => {
      const novo = !atual;
      localStorage.setItem(CHAVE_SOM_NOTIFICACAO, novo ? "1" : "0");
      return novo;
    });
  }

  useEffect(() => {
    function mover(e: MouseEvent) {
      if (!arrastandoRef.current || !containerRef.current) return;
      const inicioX = containerRef.current.getBoundingClientRect().left;
      setLarguraLista(Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, e.clientX - inicioX)));
    }
    function soltar() {
      if (!arrastandoRef.current) return;
      arrastandoRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setLarguraLista((atual) => {
        localStorage.setItem(CHAVE_LARGURA_LISTA, String(atual));
        return atual;
      });
    }
    document.addEventListener("mousemove", mover);
    document.addEventListener("mouseup", soltar);
    return () => {
      document.removeEventListener("mousemove", mover);
      document.removeEventListener("mouseup", soltar);
    };
  }, []);

  function iniciarArraste(e: ReactMouseEvent) {
    e.preventDefault();
    arrastandoRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function selecionarConversa(c: ConversaChat) {
    setSelecionadaId(c.id);
    setErroEnvio(null);
    if (c.naoLida) {
      setConversas((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, naoLida: false, mensagensNaoLidas: 0 } : x))
      );
      chamarApi(`/api/chat/conversas/${c.id}`, { method: "PATCH", body: JSON.stringify({ naoLida: false }) });
    }
  }

  async function enviarResposta() {
    if (!selecionada || !textoResposta.trim() || enviando) return;
    setEnviando(true);
    setErroEnvio(null);

    const resultado = await chamarApi<{ ok: boolean; error?: string; mensagemErro?: string; mensagem?: MensagemChat }>(
      `/api/chat/conversas/${selecionada.id}/mensagens`,
      { method: "POST", body: JSON.stringify({ texto: textoResposta }) }
    );

    if (!resultado.ok) {
      setErroEnvio(
        resultado.mensagemErro ??
          (resultado.error === "evolution_unavailable" ? "WhatsApp não está conectado agora." : "Não consegui enviar, tenta de novo.")
      );
      setEnviando(false);
      // Conflito de responsável / conversa mudou de mãos: recarrega pra tela refletir o estado real.
      if (resultado.error === "ja_assumida" || resultado.error === "nao_e_responsavel") atualizarListaAgora();
      return;
    }

    if (resultado.mensagem) setMensagens((prev) => [...prev, resultado.mensagem!]);
    setTextoResposta("");
    setEnviando(false);
    atualizarListaAgora();
  }

  async function assumirSelecionada() {
    if (!selecionada) return;
    setErroAtribuicao(null);
    const r = await chamarApi<{ ok: boolean; error?: string; mensagemErro?: string }>(`/api/chat/conversas/${selecionada.id}/assumir`, { method: "POST" });
    if (!r.ok) setErroAtribuicao(r.mensagemErro ?? "Não foi possível assumir a conversa.");
    await atualizarListaAgora();
  }

  async function transferirSelecionada(destinoId: string) {
    if (!selecionada) return;
    setErroAtribuicao(null);
    setMostrarTransferir(false);
    const r = await chamarApi<{ ok: boolean; error?: string; mensagemErro?: string }>(`/api/chat/conversas/${selecionada.id}/transferir`, {
      method: "POST",
      body: JSON.stringify({ esperadoAtribuidoA: selecionada.atribuidoAId, destinoId }),
    });
    if (!r.ok) {
      setErroAtribuicao(
        r.mensagemErro ??
          (r.error === "destino_invalido" || r.error === "destino_sem_permissao"
            ? "Essa pessoa não pode receber a conversa."
            : "Não foi possível transferir a conversa.")
      );
    }
    await atualizarListaAgora();
  }

  async function devolverSelecionadaAFila() {
    if (!selecionada || !selecionada.atribuidoAId) return;
    setErroAtribuicao(null);
    const r = await chamarApi<{ ok: boolean; error?: string }>(`/api/chat/conversas/${selecionada.id}/desatribuir`, {
      method: "POST",
      body: JSON.stringify({ esperadoAtribuidoA: selecionada.atribuidoAId }),
    });
    if (!r.ok) setErroAtribuicao("Esta conversa mudou de responsável. Atualizei a tela.");
    await atualizarListaAgora();
  }

  async function patchSelecionada(patch: Record<string, unknown>) {
    if (!selecionada) return;
    setConversas((prev) => prev.map((c) => (c.id === selecionada.id ? { ...c, ...patch } : c)));
    await chamarApi(`/api/chat/conversas/${selecionada.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    atualizarListaAgora();
  }

  async function mudarStatus(status: StatusConversa) {
    if (!selecionada) return;
    setConversas((prev) => prev.map((c) => (c.id === selecionada.id ? { ...c, status } : c)));
    await chamarApi(`/api/conversas/${selecionada.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    atualizarListaAgora();
  }

  async function pausarIA() {
    if (!selecionada) return;
    setConversas((prev) => prev.map((c) => (c.id === selecionada.id ? { ...c, agenteAtivoId: null } : c)));
    await chamarApi(`/api/chat/conversas/${selecionada.id}/agente`, {
      method: "PATCH",
      body: JSON.stringify({ acao: "pausar" }),
    });
  }

  async function retomarIA() {
    if (!selecionada) return;
    await chamarApi(`/api/chat/conversas/${selecionada.id}/agente`, {
      method: "PATCH",
      body: JSON.stringify({ acao: "retomar" }),
    });
    atualizarListaAgora();
  }

  async function finalizarAtendimentoSelecionada() {
    if (!selecionada) return;
    setConversas((prev) => prev.map((c) => (c.id === selecionada.id ? { ...c, agenteAtivoId: null } : c)));
    await chamarApi(`/api/chat/conversas/${selecionada.id}/finalizar`, { method: "POST" });
    atualizarListaAgora();
  }

  async function adicionarEtiquetaNaSelecionada(etiquetaId: string) {
    if (!selecionada) return;
    const etiqueta = etiquetas.find((e) => e.id === etiquetaId);
    if (!etiqueta) return;
    setConversas((prev) =>
      prev.map((c) => (c.id === selecionada.id ? { ...c, etiquetas: [...c.etiquetas, etiqueta] } : c))
    );
    await chamarApi(`/api/chat/conversas/${selecionada.id}/etiquetas`, {
      method: "POST",
      body: JSON.stringify({ etiquetaId }),
    });
  }

  async function removerEtiquetaDaSelecionada(etiquetaId: string) {
    if (!selecionada) return;
    setConversas((prev) =>
      prev.map((c) =>
        c.id === selecionada.id ? { ...c, etiquetas: c.etiquetas.filter((e) => e.id !== etiquetaId) } : c
      )
    );
    await chamarApi(`/api/chat/conversas/${selecionada.id}/etiquetas?etiquetaId=${etiquetaId}`, { method: "DELETE" });
  }

  async function criarEtiquetaNova() {
    const nome = novoNomeEtiqueta.trim();
    if (!nome) return;
    const resultado = await chamarApi<{ ok: boolean; etiqueta?: Etiqueta; error?: string }>("/api/chat/etiquetas", {
      method: "POST",
      body: JSON.stringify({ nome }),
    });
    if (resultado.ok && resultado.etiqueta) {
      setEtiquetas((prev) => [...prev, resultado.etiqueta!]);
      setNovoNomeEtiqueta("");
      if (selecionada) adicionarEtiquetaNaSelecionada(resultado.etiqueta.id);
    }
  }

  return (
    <div ref={containerRef} className="flex h-[calc(100dvh-3.5rem)] min-h-0">
      <section
        style={{ "--largura-lista": `${larguraLista}px` } as { [key: string]: string }}
        className={`flex w-full min-w-0 flex-col border-r border-neutral-200 bg-white sm:w-[var(--largura-lista)] sm:shrink-0 ${
          selecionadaId ? "hidden sm:flex" : "flex"
        }`}
      >
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Chat ao Vivo</h1>
            <p className="text-xs text-neutral-500">{clinicaNome} · WhatsApp</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title={somAtivo ? "Som de mensagem ligado — clique pra desligar" : "Som de mensagem desligado — clique pra ligar"}
              aria-pressed={somAtivo}
              onClick={alternarSom}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100 ${
                somAtivo ? "text-neutral-500" : "text-neutral-300"
              }`}
            >
              {somAtivo ? <IconeSom /> : <IconeSomMudo />}
            </button>
            <button
              type="button"
              title="Nova conversa"
              onClick={() => setMostrarNovaConversa(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-700 text-lg font-medium text-white hover:bg-teal-800"
            >
              +
            </button>
          </div>
        </header>

        <div className="border-b border-neutral-200 px-4 py-3">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar conversa (mín. 3 letras)..."
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 px-3 py-2">
          <select
            value={aba === "arquivadas" ? "todos" : aba}
            onChange={(e) => setAba(e.target.value as AbaChat)}
            title="Fila"
            className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700"
          >
            {OPCOES_FILA.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.label} ({contagens[o.valor]})
              </option>
            ))}
          </select>

          <div className="mx-1 h-6 w-px shrink-0 bg-neutral-200" />

          <FiltroPrioridadeBotao valor={filtroPrioridade} onChange={setFiltroPrioridade} />
          <FiltroEtiquetaBotao etiquetas={etiquetas} valor={filtroEtiquetaId} onChange={setFiltroEtiquetaId} />
          {varioscanais && (
            <select
              value={filtroCanalId}
              onChange={(e) => setFiltroCanalId(e.target.value)}
              title="Filtrar por canal"
              className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600"
            >
              <option value="">Todos os canais</option>
              {canais.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          )}
          <select
            value={filtroResponsavel}
            onChange={(e) => setFiltroResponsavel(e.target.value)}
            title="Filtrar por responsável"
            className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600"
          >
            <option value="">Qualquer responsável</option>
            <option value="sem">Sem responsável</option>
            <option value="meus">Meus</option>
            {atendentes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as OrdemChat)}
            title="Ordenação"
            className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600"
          >
            {OPCOES_ORDEM.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={filtroSla}
            onChange={(e) => setFiltroSla(e.target.value as FiltroSla)}
            title="Filtrar por SLA"
            className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600"
          >
            {OPCOES_FILTRO_SLA.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setOrdenarPorSla((v) => !v)}
            title="Ordenar por risco de SLA (mais crítico primeiro)"
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
              ordenarPorSla ? "border-red-300 bg-red-50 text-red-700" : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            ⚠ Risco
          </button>

          <div className="ml-auto flex items-center gap-1">
            <BotaoIconeAba
              label="Arquivadas"
              ativo={aba === "arquivadas"}
              contagem={contagens.arquivadas}
              onClick={() => setAba(aba === "arquivadas" ? "todos" : "arquivadas")}
            >
              <IconeArquivo />
            </BotaoIconeAba>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversasFiltradas.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-neutral-400">Nenhuma conversa aqui.</p>
          )}
          {conversasFiltradas.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => selecionarConversa(c)}
              className={`flex w-full items-start gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors hover:bg-neutral-50 ${
                selecionadaId === c.id ? "bg-teal-50" : ""
              }`}
            >
              <Avatar nome={c.pacienteNome} telefone={c.telefone} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-sm ${c.naoLida ? "font-semibold text-neutral-900" : "font-medium text-neutral-700"}`}>
                    {c.pacienteNome || formatTelefone(c.telefone)}
                  </p>
                  <span className="shrink-0 text-[11px] text-neutral-400">{formatHoraCurta(c.ultimaMensagemEm)}</span>
                </div>
                <SlaBadge status={slaPorConversa[c.id]} compacto />
                <p className="mt-0.5 truncate text-[11px] text-neutral-400">
                  {varioscanais && c.canalNome ? `${c.canalNome} · ` : ""}
                  {c.atribuidoANome ? `Responsável: ${c.atribuidoANome}` : "Sem responsável"}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORIDADE_CONFIG[c.prioridade].corPonto}`} />
                  <p className={`truncate text-xs ${c.naoLida ? "font-medium text-neutral-700" : "text-neutral-500"}`}>
                    {c.ultimaMensagemDirecao === "enviada" ? "Você: " : ""}
                    {c.ultimaMensagemPreview ?? "Sem mensagens ainda"}
                  </p>
                  {c.mensagensNaoLidas > 0 && (
                    <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-teal-600 px-1 text-[10px] font-semibold text-white">
                      {c.mensagensNaoLidas > 99 ? "99+" : c.mensagensNaoLidas}
                    </span>
                  )}
                </div>
                {c.etiquetas.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.etiquetas.slice(0, 3).map((et) => (
                      <span
                        key={et.id}
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: et.cor }}
                      >
                        {et.nome}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      <div
        onMouseDown={iniciarArraste}
        title="Arrastar pra redimensionar"
        className="hidden w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-teal-200 active:bg-teal-400 sm:block"
      />

      <section className={`min-h-0 min-w-0 flex-1 flex-col bg-neutral-50 ${selecionadaId ? "flex" : "hidden sm:flex"}`}>
        {!selecionada ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-neutral-400">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-2xl">💬</div>
            <p className="text-sm font-medium text-neutral-500">Selecione uma conversa</p>
            <p className="text-xs">Escolha uma conversa à esquerda pra começar</p>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
              <button
                type="button"
                onClick={() => setSelecionadaId(null)}
                className="text-sm text-teal-700 sm:hidden"
              >
                ← Voltar
              </button>
              <Avatar nome={selecionada.pacienteNome} telefone={selecionada.telefone} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {selecionada.pacienteNome || "Sem nome"}
                </p>
                <p className="text-xs text-neutral-500">
                  {formatTelefone(selecionada.telefone)}
                  {selecionada.canalNome ? ` · ${selecionada.canalNome}` : nomeCanal(selecionada.canalId) ? ` · ${nomeCanal(selecionada.canalId)}` : ""}
                </p>
                <p className="text-[11px] font-medium text-teal-700">{textoControle(selecionada)}</p>
              </div>

              <select
                value={selecionada.status}
                onChange={(e) => mudarStatus(e.target.value as StatusConversa)}
                className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_CONFIG[selecionada.status].corBadge}`}
              >
                {STATUS_ORDEM.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </option>
                ))}
              </select>

              {selecionada.agenteAtivoId ? (
                <button
                  type="button"
                  onClick={pausarIA}
                  title="Um humano assume: a IA para de responder essa conversa"
                  className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                >
                  Pausar IA
                </button>
              ) : (
                etiquetasComAgente.some((eid) => selecionada.etiquetas.some((e) => e.id === eid)) && (
                  <button
                    type="button"
                    onClick={retomarIA}
                    title="Volta a deixar a IA responder essa conversa"
                    className="rounded-full border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100"
                  >
                    Retomar IA
                  </button>
                )
              )}

              <button
                type="button"
                onClick={finalizarAtendimentoSelecionada}
                className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Finalizar Atendimento
              </button>

              <SlaBadge status={slaPorConversa[selecionada.id]} />

              <select
                value={selecionada.prioridade}
                onChange={(e) => patchSelecionada({ prioridade: e.target.value })}
                className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${PRIORIDADE_CONFIG[selecionada.prioridade].corBadge}`}
              >
                {PRIORIDADE_ORDEM.map((p) => (
                  <option key={p} value={p}>
                    {PRIORIDADE_CONFIG[p].label}
                  </option>
                ))}
              </select>

              <ResponsavelControles
                conversa={selecionada}
                atendenteAtualId={atendenteAtualId}
                atendentesDestino={atendentesDestino}
                podeAssumir={pode("conversas.assumir")}
                podeMexer={
                  pode("conversas.transferir") &&
                  (!selecionada.atribuidoAId ||
                    selecionada.atribuidoAId === atendenteAtualId ||
                    pode("conversas.visualizar_todas") ||
                    pode("conversas.intervir"))
                }
                mostrarTransferir={mostrarTransferir}
                setMostrarTransferir={setMostrarTransferir}
                onAssumir={assumirSelecionada}
                onTransferir={transferirSelecionada}
                onDevolver={devolverSelecionadaAFila}
              />

              <button
                type="button"
                onClick={() => patchSelecionada({ arquivada: !selecionada.arquivada })}
                className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
              >
                {selecionada.arquivada ? "Desarquivar" : "Arquivar"}
              </button>

              <div className="relative flex flex-wrap items-center gap-1">
                {selecionada.etiquetas.map((et) => (
                  <span
                    key={et.id}
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: et.cor }}
                  >
                    {et.nome}
                    <button type="button" onClick={() => removerEtiquetaDaSelecionada(et.id)} className="opacity-80 hover:opacity-100">
                      ×
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setMostrarEtiquetaPopover((v) => !v)}
                  className="rounded-full border border-dashed border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-neutral-500 hover:bg-neutral-100"
                >
                  + etiqueta
                </button>
                {mostrarEtiquetaPopover && (
                  <div className="absolute right-0 top-8 z-10 w-56 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
                    {etiquetas
                      .filter((et) => !selecionada.etiquetas.some((se) => se.id === et.id))
                      .map((et) => (
                        <button
                          key={et.id}
                          type="button"
                          onClick={() => {
                            adicionarEtiquetaNaSelecionada(et.id);
                            setMostrarEtiquetaPopover(false);
                          }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-neutral-50"
                        >
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: et.cor }} />
                          {et.nome}
                        </button>
                      ))}
                    <div className="mt-1 flex gap-1 border-t border-neutral-100 pt-2">
                      <input
                        type="text"
                        value={novoNomeEtiqueta}
                        onChange={(e) => setNovoNomeEtiqueta(e.target.value)}
                        placeholder="Nova etiqueta"
                        className="min-w-0 flex-1 rounded border border-neutral-200 px-2 py-1 text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={criarEtiquetaNova}
                        className="rounded bg-teal-700 px-2 py-1 text-xs font-medium text-white hover:bg-teal-800"
                      >
                        Criar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {carregandoMensagens && <p className="text-center text-xs text-neutral-400">Carregando…</p>}
              {!carregandoMensagens && mensagens.length === 0 && (
                <p className="text-center text-sm text-neutral-400">Nenhuma mensagem ainda.</p>
              )}
              {mensagens.map((m) => (
                <div key={m.id} className={`flex ${m.direcao === "enviada" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                      m.direcao === "enviada" ? "bg-teal-700 text-white" : "border border-neutral-200 bg-white text-neutral-800"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.conteudo ?? `[${m.tipo}]`}</p>
                    <p className={`mt-1 text-right text-[10px] ${m.direcao === "enviada" ? "text-teal-100" : "text-neutral-400"}`}>
                      {formatHoraCurta(m.quando)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={fimDaThreadRef} />
            </div>

            <NotasInternas conversaId={selecionada.id} />

            <div className="shrink-0 border-t border-neutral-200 bg-white px-4 py-3">
              {erroAtribuicao && <p className="mb-1.5 text-xs text-amber-700">{erroAtribuicao}</p>}
              {erroEnvio && <p className="mb-1.5 text-xs text-red-600">{erroEnvio}</p>}
              {selecionada.atribuidoAId && selecionada.atribuidoAId !== atendenteAtualId && (
                <p className="mb-1.5 text-xs text-neutral-500">
                  {selecionada.atribuidoANome ?? "Outra pessoa"} está atendendo esta conversa.
                  {!pode("conversas.intervir") && " Só ela (ou quem tem permissão de intervir) responde."}
                </p>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={textoResposta}
                  onChange={(e) => setTextoResposta(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviarResposta();
                    }
                  }}
                  disabled={!podeResponderSelecionada}
                  placeholder={
                    !podeResponderSelecionada
                      ? "Você não pode responder esta conversa"
                      : selecionada.atribuidoAId
                        ? "Escreva uma resposta…"
                        : "Escreva uma resposta… (ao enviar, você assume esta conversa)"
                  }
                  rows={1}
                  className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
                <button
                  type="button"
                  disabled={enviando || !textoResposta.trim() || !podeResponderSelecionada}
                  onClick={enviarResposta}
                  className="shrink-0 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {enviando ? "Enviando…" : "Enviar"}
                </button>
              </div>
            </div>

          </>
        )}
      </section>

      {mostrarNovaConversa && (
        <NovaConversaModal
          canais={canais}
          onFechar={() => setMostrarNovaConversa(false)}
          onCriada={(conversaId) => {
            setMostrarNovaConversa(false);
            atualizarListaAgora().then(() => setSelecionadaId(conversaId));
          }}
        />
      )}
    </div>
  );
}

/** Botão de ícone com contador — usado nas abas e em Arquivadas, mesma cara da RoiZap (ícone + número, não texto). */
function BotaoIconeAba({
  label,
  ativo,
  contagem,
  onClick,
  children,
}: {
  label: string;
  ativo: boolean;
  contagem: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
        ativo ? "bg-teal-700 text-white" : "text-neutral-500 hover:bg-neutral-100"
      }`}
    >
      {children}
      {contagem > 0 && (
        <span
          className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold ${
            ativo ? "bg-white text-teal-700" : "bg-red-500 text-white"
          }`}
        >
          {contagem > 99 ? "99+" : contagem}
        </span>
      )}
    </button>
  );
}

/** Hook mínimo de popover (fecha ao clicar fora) — usado nos 2 filtros abaixo, não vale abstrair mais que isto por só 2 usos. */
function usePopoverFechavel<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  return { ref, aberto, setAberto };
}

function FiltroPrioridadeBotao({
  valor,
  onChange,
}: {
  valor: Prioridade | "";
  onChange: (v: Prioridade | "") => void;
}) {
  const { ref, aberto, setAberto } = usePopoverFechavel<HTMLDivElement>();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Filtrar por prioridade"
        onClick={() => setAberto((v) => !v)}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          valor ? "bg-teal-50 text-teal-700" : "text-neutral-500 hover:bg-neutral-100"
        }`}
      >
        <IconeBandeira />
      </button>
      {aberto && (
        <div className="absolute left-0 top-11 z-20 w-52 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
          <p className="mb-1 px-2 pt-1 text-xs font-medium text-neutral-500">Filtrar por prioridade</p>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setAberto(false);
            }}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${!valor ? "bg-neutral-100" : "hover:bg-neutral-50"}`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
            Toda prioridade
          </button>
          {PRIORIDADE_ORDEM.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                onChange(valor === p ? "" : p);
                setAberto(false);
              }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${valor === p ? "bg-teal-50" : "hover:bg-neutral-50"}`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${PRIORIDADE_CONFIG[p].corPonto}`} />
              {PRIORIDADE_CONFIG[p].label}
              {valor === p && (
                <span className="ml-auto text-teal-700">
                  <IconeCheckMini />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FiltroEtiquetaBotao({
  etiquetas,
  valor,
  onChange,
}: {
  etiquetas: Etiqueta[];
  valor: string;
  onChange: (v: string) => void;
}) {
  const { ref, aberto, setAberto } = usePopoverFechavel<HTMLDivElement>();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Filtrar por etiquetas"
        onClick={() => setAberto((v) => !v)}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          valor ? "bg-teal-50 text-teal-700" : "text-neutral-500 hover:bg-neutral-100"
        }`}
      >
        <IconeEtiqueta />
      </button>
      {aberto && (
        <div className="absolute left-0 top-11 z-20 w-56 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
          <p className="mb-1 px-2 pt-1 text-xs font-medium text-neutral-500">Filtrar por etiquetas</p>
          {etiquetas.length === 0 ? (
            <p className="px-2 py-2 text-xs text-neutral-400">Nenhuma etiqueta criada ainda.</p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setAberto(false);
                }}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${!valor ? "bg-neutral-100" : "hover:bg-neutral-50"}`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
                Toda etiqueta
              </button>
              {etiquetas.map((et) => (
                <button
                  key={et.id}
                  type="button"
                  onClick={() => {
                    onChange(valor === et.id ? "" : et.id);
                    setAberto(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${valor === et.id ? "bg-teal-50" : "hover:bg-neutral-50"}`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: et.cor }} />
                  <span className="truncate">{et.nome}</span>
                  {valor === et.id && (
                    <span className="ml-auto shrink-0 text-teal-700">
                      <IconeCheckMini />
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function IconeArquivo() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
    </svg>
  );
}

function IconeBandeira() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M5 21V4" />
      <path d="M5 4h13l-3 4 3 4H5" />
    </svg>
  );
}

function IconeEtiqueta() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12.6 3.5 20 4l.5 7.4-9.1 9.1a1.5 1.5 0 0 1-2.1 0L3.5 14.7a1.5 1.5 0 0 1 0-2.1Z" />
      <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconeSom() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      <path d="M19 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

function IconeSomMudo() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="m17 9 4 6M21 9l-4 6" />
    </svg>
  );
}

function IconeCheckMini() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

function NovaConversaModal({
  onFechar,
  onCriada,
  canais,
}: {
  onFechar: () => void;
  onCriada: (conversaId: string) => void;
  canais: CanalChat[];
}) {
  const canaisAtivos = canais.filter((c) => c.ativo);
  const [canalId, setCanalId] = useState("");
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    if (!telefone.trim() || !texto.trim() || enviando) return;
    setEnviando(true);
    setErro(null);

    const resultado = await chamarApi<{ ok: boolean; error?: string; mensagemErro?: string; conversaId?: string }>("/api/chat/conversas", {
      method: "POST",
      body: JSON.stringify({ telefone, nome: nome || undefined, texto, canalId: canalId || undefined }),
    });

    if (!resultado.ok || !resultado.conversaId) {
      setErro(
        resultado.mensagemErro ??
          (resultado.error === "telefone_invalido"
            ? "Telefone inválido — confira o DDD."
            : resultado.error === "evolution_unavailable"
              ? "WhatsApp não está conectado agora."
              : "Não consegui enviar, tenta de novo.")
      );
      setEnviando(false);
      return;
    }

    onCriada(resultado.conversaId);
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h2 className="mb-3 text-base font-semibold text-neutral-900">Nova conversa</h2>

        {canaisAtivos.length > 1 && (
          <label className="mb-2 block text-xs font-medium text-neutral-500">
            Enviar pelo canal
            <select
              value={canalId}
              onChange={(e) => setCanalId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
            >
              <option value="">Canal principal</option>
              {canaisAtivos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="mb-2 block text-xs font-medium text-neutral-500">
          Telefone
          <input
            type="text"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(61) 99999-8888"
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </label>

        <label className="mb-2 block text-xs font-medium text-neutral-500">
          Nome (opcional)
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </label>

        <label className="mb-3 block text-xs font-medium text-neutral-500">
          Primeira mensagem
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
        </label>

        {erro && <p className="mb-2 text-xs text-red-600">{erro}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onFechar} className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">
            Cancelar
          </button>
          <button
            type="button"
            disabled={enviando || !telefone.trim() || !texto.trim()}
            onClick={criar}
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Responsável + Assumir + Transferir + Devolver à fila. O backend é quem autoriza; aqui só evita mostrar botão que não serve. */
function ResponsavelControles({
  conversa,
  atendenteAtualId,
  atendentesDestino,
  podeAssumir,
  podeMexer,
  mostrarTransferir,
  setMostrarTransferir,
  onAssumir,
  onTransferir,
  onDevolver,
}: {
  conversa: ConversaChat;
  atendenteAtualId: string | null;
  atendentesDestino: Atendente[];
  podeAssumir: boolean;
  podeMexer: boolean;
  mostrarTransferir: boolean;
  setMostrarTransferir: (v: boolean) => void;
  onAssumir: () => void;
  onTransferir: (destinoId: string) => void;
  onDevolver: () => void;
}) {
  const semResponsavel = !conversa.atribuidoAId;
  const souEu = conversa.atribuidoAId === atendenteAtualId;
  const destinos = atendentesDestino.filter((a) => a.id !== conversa.atribuidoAId);

  return (
    <div className="relative flex flex-wrap items-center gap-1">
      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
        {semResponsavel ? "Sem responsável" : souEu ? "Atendida por você" : `Atendida por ${conversa.atribuidoANome ?? "outra pessoa"}`}
      </span>
      {semResponsavel && podeAssumir && (
        <button type="button" onClick={onAssumir} className="rounded-full bg-teal-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-800">
          Assumir
        </button>
      )}
      {podeMexer && (
        <button
          type="button"
          onClick={() => setMostrarTransferir(!mostrarTransferir)}
          className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        >
          Transferir
        </button>
      )}
      {podeMexer && !semResponsavel && (
        <button
          type="button"
          onClick={onDevolver}
          title="Devolver a conversa para a fila (sem responsável)"
          className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        >
          Devolver à fila
        </button>
      )}
      {mostrarTransferir && (
        <div className="absolute right-0 top-8 z-10 w-56 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
          {destinos.length === 0 && <p className="px-2 py-1.5 text-xs text-neutral-400">Ninguém disponível.</p>}
          {destinos.map((a) => (
            <button key={a.id} type="button" onClick={() => onTransferir(a.id)} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-neutral-50">
              {a.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
