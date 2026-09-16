"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AgenteIA, DadosAgente } from "@/lib/agentes";
import type { ModeloIA } from "@/lib/ia-provedores";

type Etiqueta = { id: string; nome: string; cor: string };

const PROMPT_SUGERIDO =
  "Você é a assistente virtual da OdontoMinas, respondendo pacientes pelo WhatsApp. Seja " +
  "acolhedora, direta e breve. Nunca prometa resultado de tratamento, nunca use superlativo " +
  "('o melhor', 'garantido') e nunca invente informação clínica ou de preço que você não tem " +
  "certeza — nesses casos, ofereça transferir pra um atendente humano. Sempre que o paciente " +
  "pedir pra falar com uma pessoa, respeite e avise que vai encaminhar.";

export function AgenteForm({
  agente,
  etiquetasIniciais,
  modelos,
}: {
  agente?: AgenteIA;
  etiquetasIniciais: Etiqueta[];
  modelos: ModeloIA[];
}) {
  const router = useRouter();
  const editando = Boolean(agente);

  const [nome, setNome] = useState(agente?.nome ?? "");
  const [descricao, setDescricao] = useState(agente?.descricao ?? "");
  const [etiquetas, setEtiquetas] = useState(etiquetasIniciais);
  const [etiquetaGatilhoId, setEtiquetaGatilhoId] = useState(agente?.etiquetaGatilhoId ?? "");
  const [novaEtiqueta, setNovaEtiqueta] = useState("");
  const [criandoEtiqueta, setCriandoEtiqueta] = useState(false);

  const modeloChaveInicial = agente ? `${agente.provider}:${agente.modelo}` : (modelos[0] ? `${modelos[0].provider}:${modelos[0].id}` : "");
  const [modeloChave, setModeloChave] = useState(modeloChaveInicial);
  const [temperatura, setTemperatura] = useState(agente?.temperatura ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(agente?.maxTokens ?? 700);

  const [promptSistema, setPromptSistema] = useState(agente?.promptSistema ?? PROMPT_SUGERIDO);

  const [incluirHistorico, setIncluirHistorico] = useState(agente?.incluirHistorico ?? true);
  const [qtdHistorico, setQtdHistorico] = useState(agente?.qtdHistorico ?? 10);
  const [pausarAoResponderHumano, setPausarAoResponderHumano] = useState(agente?.pausarAoResponderHumano ?? true);
  const [tempoPausaMin, setTempoPausaMin] = useState(agente?.tempoPausaMin ?? 480);

  const [responderApenasHorario, setResponderApenasHorario] = useState(agente?.responderApenasHorario ?? false);
  const [horarioInicio, setHorarioInicio] = useState(agente?.horarioInicio ?? "08:00");
  const [horarioFim, setHorarioFim] = useState(agente?.horarioFim ?? "18:00");
  const [maxCaracteresResposta, setMaxCaracteresResposta] = useState(agente?.maxCaracteresResposta ?? 0);
  const [pausarAposConcluirFluxo, setPausarAposConcluirFluxo] = useState(agente?.pausarAposConcluirFluxo ?? false);
  const [dividirEmMensagensCurtas, setDividirEmMensagensCurtas] = useState(agente?.dividirEmMensagensCurtas ?? false);
  const [bufferMensagens, setBufferMensagens] = useState(agente?.bufferMensagens ?? false);
  const [bufferSegundos, setBufferSegundos] = useState(agente?.bufferSegundos ?? 8);

  const [ativarTransferencia, setAtivarTransferencia] = useState(agente?.ativarTransferencia ?? false);
  const [mensagemTransferencia, setMensagemTransferencia] = useState(agente?.mensagemTransferencia ?? "");

  const [notificarNumeros, setNotificarNumeros] = useState(agente?.notificarNumeros ?? "");
  const [notificarPedidoHumano, setNotificarPedidoHumano] = useState(agente?.notificarPedidoHumano ?? true);
  const [notificarFallback, setNotificarFallback] = useState(agente?.notificarFallback ?? false);
  const [notificarIntencaoCompra, setNotificarIntencaoCompra] = useState(agente?.notificarIntencaoCompra ?? false);
  const [notificarNovoLead, setNotificarNovoLead] = useState(agente?.notificarNovoLead ?? false);
  const [mensagemNotificacao, setMensagemNotificacao] = useState(agente?.mensagemNotificacao ?? "");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criarEtiquetaInline() {
    const nomeEtiqueta = novaEtiqueta.trim();
    if (!nomeEtiqueta || criandoEtiqueta) return;
    setCriandoEtiqueta(true);
    try {
      const resposta = await fetch("/api/chat/etiquetas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nomeEtiqueta }),
      });
      const dados = (await resposta.json()) as { ok: boolean; etiqueta?: Etiqueta };
      if (dados.ok && dados.etiqueta) {
        setEtiquetas((atual) => [...atual, dados.etiqueta as Etiqueta]);
        setEtiquetaGatilhoId(dados.etiqueta.id);
        setNovaEtiqueta("");
      }
    } finally {
      setCriandoEtiqueta(false);
    }
  }

  async function salvar() {
    if (!nome.trim() || !modeloChave || salvando) return;
    setSalvando(true);
    setErro(null);

    const [provider, ...resto] = modeloChave.split(":");
    const modeloId = resto.join(":");

    const payload: DadosAgente = {
      nome,
      descricao: descricao || null,
      etiquetaGatilhoId: etiquetaGatilhoId || null,
      provider: provider as DadosAgente["provider"],
      modelo: modeloId,
      promptSistema,
      temperatura,
      maxTokens,
      incluirHistorico,
      qtdHistorico,
      pausarAoResponderHumano,
      tempoPausaMin,
      mensagemTransferencia: mensagemTransferencia || null,
      responderApenasHorario,
      horarioInicio: responderApenasHorario ? horarioInicio : null,
      horarioFim: responderApenasHorario ? horarioFim : null,
      maxCaracteresResposta: maxCaracteresResposta > 0 ? maxCaracteresResposta : null,
      pausarAposConcluirFluxo,
      dividirEmMensagensCurtas,
      bufferMensagens,
      bufferSegundos,
      ativarTransferencia,
      notificarNumeros: notificarNumeros || null,
      notificarPedidoHumano,
      notificarFallback,
      notificarIntencaoCompra,
      notificarNovoLead,
      mensagemNotificacao: mensagemNotificacao || null,
    };

    try {
      const resposta = await fetch(editando ? `/api/agentes/${agente!.id}` : "/api/agentes", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const dados = (await resposta.json()) as { ok: boolean; error?: string };
      if (!dados.ok) throw new Error(dados.error ?? "falhou");

      router.push("/agentes");
      router.refresh();
    } catch (e) {
      setErro(mensagemErro((e as Error).message));
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">Configuração Básica</h2>
        <div className="space-y-3">
          <Campo label="Nome">
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Agente de Atendimento"
              className={campoClasses}
            />
          </Campo>
          <Campo label="Descrição (opcional)">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              className={campoClasses}
            />
          </Campo>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">Gatilho de Ativação</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Quando essa etiqueta for aplicada numa conversa (Chat ao Vivo), o agente passa a responder
          o paciente automaticamente por lá.
        </p>
        <Campo label="Etiqueta que ativa o agente">
          <select value={etiquetaGatilhoId} onChange={(e) => setEtiquetaGatilhoId(e.target.value)} className={campoClasses}>
            <option value="">Sem gatilho ainda (não ativa sozinho)</option>
            {etiquetas.map((et) => (
              <option key={et.id} value={et.id}>
                {et.nome}
              </option>
            ))}
          </select>
        </Campo>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={novaEtiqueta}
            onChange={(e) => setNovaEtiqueta(e.target.value)}
            placeholder="Criar etiqueta nova…"
            className={`${campoClasses} flex-1`}
          />
          <button
            type="button"
            onClick={criarEtiquetaInline}
            disabled={!novaEtiqueta.trim() || criandoEtiqueta}
            className="shrink-0 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {criandoEtiqueta ? "Criando…" : "Criar"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">Modelo de IA</h2>
        {modelos.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Nenhum provedor de IA configurado neste ambiente ainda — falta uma chave de API (ver
            .env.example: GOOGLE_API_KEY ou GROQ_API_KEY são grátis).
          </p>
        ) : (
          <Campo label="Modelo">
            <select value={modeloChave} onChange={(e) => setModeloChave(e.target.value)} className={campoClasses}>
              {modelos.map((m) => (
                <option key={`${m.provider}:${m.id}`} value={`${m.provider}:${m.id}`}>
                  {m.label} {m.gratis ? "— Grátis" : "— Pago"}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Campo label={`Criatividade (temperatura): ${temperatura.toFixed(1)}`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={temperatura}
              onChange={(e) => setTemperatura(Number(e.target.value))}
              className="w-full accent-teal-700"
            />
          </Campo>
          <Campo label="Máximo de tokens por resposta">
            <input
              type="number"
              min={50}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className={campoClasses}
            />
          </Campo>
        </div>

        <div className="mt-4 border-t border-neutral-100 pt-4">
          <Toggle
            label="Responder somente em horário de atendimento"
            descricao="Fora desse horário, o agente não responde — a mensagem fica visível no Chat ao Vivo pra tratar depois."
            valor={responderApenasHorario}
            onChange={setResponderApenasHorario}
          />
          {responderApenasHorario && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Campo label="Início">
                <input type="time" value={horarioInicio} onChange={(e) => setHorarioInicio(e.target.value)} className={campoClasses} />
              </Campo>
              <Campo label="Fim">
                <input type="time" value={horarioFim} onChange={(e) => setHorarioFim(e.target.value)} className={campoClasses} />
              </Campo>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">Prompt do Agente</h2>
        <p className="mb-3 text-xs text-neutral-500">As instruções que moldam como a IA responde — a parte mais importante.</p>
        <textarea
          value={promptSistema}
          onChange={(e) => setPromptSistema(e.target.value)}
          rows={7}
          className={campoClasses}
        />
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-neutral-900">Comportamento</h2>
        <div className="space-y-4">
          <Toggle
            label="Incluir histórico da conversa"
            descricao="A IA lê as últimas mensagens antes de responder, pra manter o contexto."
            valor={incluirHistorico}
            onChange={setIncluirHistorico}
          />
          {incluirHistorico && (
            <Campo label="Quantidade de mensagens no histórico">
              <input
                type="number"
                min={1}
                max={50}
                value={qtdHistorico}
                onChange={(e) => setQtdHistorico(Number(e.target.value))}
                className={`${campoClasses} max-w-[8rem]`}
              />
            </Campo>
          )}

          <Toggle
            label="Pausar quando um humano responder"
            descricao="Se alguém da equipe responder manualmente pelo Chat ao Vivo, o agente para de responder por um tempo."
            valor={pausarAoResponderHumano}
            onChange={setPausarAoResponderHumano}
          />
          {pausarAoResponderHumano && (
            <Campo label="Tempo de pausa (minutos)">
              <input
                type="number"
                min={1}
                value={tempoPausaMin}
                onChange={(e) => setTempoPausaMin(Number(e.target.value))}
                className={`${campoClasses} max-w-[8rem]`}
              />
            </Campo>
          )}

          <Toggle
            label="Pausar agente após concluir o atendimento"
            descricao="Quando a conversa chega a Respondido, Agendado ou Perdido, o agente para de escutar essa conversa até a etiqueta ser aplicada de novo."
            valor={pausarAposConcluirFluxo}
            onChange={setPausarAposConcluirFluxo}
          />

          <Campo label="Tamanho máximo da resposta (caracteres, 0 = sem limite)">
            <input
              type="number"
              min={0}
              value={maxCaracteresResposta}
              onChange={(e) => setMaxCaracteresResposta(Number(e.target.value))}
              className={`${campoClasses} max-w-[10rem]`}
            />
          </Campo>

          <Toggle
            label="Dividir resposta em mensagens curtas"
            descricao="Em vez de mandar um bloco só, parte a resposta em até algumas bolhas (o campo 'Máximo de mensagens por resposta' acima define quantas)."
            valor={dividirEmMensagensCurtas}
            onChange={setDividirEmMensagensCurtas}
          />

          <Toggle
            label="Aguardar mensagens seguidas antes de responder"
            descricao="Se o paciente mandar várias mensagens em sequência, a IA espera um tempo depois da última pra responder tudo de uma vez, em vez de responder mensagem por mensagem."
            valor={bufferMensagens}
            onChange={setBufferMensagens}
          />
          {bufferMensagens && (
            <Campo label="Esperar depois da última mensagem (segundos)">
              <input
                type="number"
                min={2}
                max={60}
                value={bufferSegundos}
                onChange={(e) => setBufferSegundos(Number(e.target.value))}
                className={`${campoClasses} max-w-[8rem]`}
              />
            </Campo>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">Transferência para Humano</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Se o paciente pedir explicitamente pra falar com uma pessoa (palavras como
          &quot;atendente&quot;, &quot;humano&quot;, &quot;recepcionista&quot;), o agente para de
          responder essa conversa e manda a mensagem abaixo em vez de chamar a IA.
        </p>
        <Toggle
          label="Ativar transferência"
          descricao="A IA identifica o pedido do cliente e entrega a conversa"
          valor={ativarTransferencia}
          onChange={setAtivarTransferencia}
        />
        {ativarTransferencia && (
          <div className="mt-3">
            <Campo label="Mensagem de transferência">
              <textarea
                value={mensagemTransferencia}
                onChange={(e) => setMensagemTransferencia(e.target.value)}
                rows={2}
                placeholder="Ex.: Já te encaminho pra nossa equipe, um momento 🙏"
                className={campoClasses}
              />
            </Campo>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">Avisar Membro da Equipe</h2>
        <p className="mb-3 text-xs text-neutral-500">
          Manda uma notificação via WhatsApp pra um número interno quando alguma das situações
          abaixo acontecer.
        </p>
        <Campo label="Números para notificação (separados por vírgula)">
          <input
            type="text"
            value={notificarNumeros}
            onChange={(e) => setNotificarNumeros(e.target.value)}
            placeholder="5561999990000, 5561988880000"
            className={campoClasses}
          />
        </Campo>

        <div className="mt-4 space-y-4">
          <Toggle
            label="Pedido de atendimento humano"
            descricao="Quando o cliente pede pra falar com humano, ou ativa a Transferência acima."
            valor={notificarPedidoHumano}
            onChange={setNotificarPedidoHumano}
          />
          <Toggle
            label="IA não sabe responder (fallback)"
            descricao="A própria IA não conseguiu gerar uma resposta."
            valor={notificarFallback}
            onChange={setNotificarFallback}
          />
          <Toggle
            label="Intenção de agendar / comprar"
            descricao="Detecta intenção clara de agendar consulta ou saber preço pelo contexto da mensagem."
            valor={notificarIntencaoCompra}
            onChange={setNotificarIntencaoCompra}
          />
          <Toggle
            label="Primeiro contato de novo lead"
            descricao="Dispara apenas na primeira mensagem de um contato novo."
            valor={notificarNovoLead}
            onChange={setNotificarNovoLead}
          />
        </div>

        <div className="mt-4">
          <Campo label="Mensagem de notificação">
            <textarea
              value={mensagemNotificacao}
              onChange={(e) => setMensagemNotificacao(e.target.value)}
              rows={3}
              placeholder={"🔔 {motivo}\n👤 {nome}\n📱 {telefone}\n💬 \"{resumo}\""}
              className={campoClasses}
            />
          </Campo>
          <p className="mt-1 text-xs text-neutral-400">
            Variáveis disponíveis: <code>{"{motivo}"}</code>, <code>{"{nome}"}</code>,{" "}
            <code>{"{telefone}"}</code>, <code>{"{resumo}"}</code>
          </p>
        </div>
      </section>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/agentes")}
          className="rounded-lg px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-100"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={!nome.trim() || !modeloChave || salvando}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar agente"}
        </button>
      </div>
    </div>
  );
}

const campoClasses =
  "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-teal-600";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  descricao,
  valor,
  onChange,
}: {
  label: string;
  descricao: string;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-neutral-900">{label}</p>
        <p className="text-xs text-neutral-500">{descricao}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={valor}
        onClick={() => onChange(!valor)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${valor ? "bg-teal-700" : "bg-neutral-200"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            valor ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function mensagemErro(codigo: string): string {
  const mapa: Record<string, string> = {
    nome_obrigatorio: "Dá um nome pro agente.",
    modelo_invalido: "Escolhe um modelo de IA válido.",
    temperatura_invalida: "Temperatura precisa ficar entre 0 e 1.",
    backend_unavailable: "Não consegui conectar ao banco agora, tenta de novo.",
  };
  return mapa[codigo] ?? "Não consegui salvar, tenta de novo.";
}
