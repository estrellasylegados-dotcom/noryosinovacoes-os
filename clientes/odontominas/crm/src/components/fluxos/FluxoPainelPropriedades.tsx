"use client";

import { useState, type ReactNode } from "react";
import { adicionarOpcaoMenu, removerOpcaoMenu } from "@/lib/fluxo-editor-grafo";
import type {
  NoAdicionarEtiqueta,
  NoAtribuirAtendente,
  NoCapturarResposta,
  NoCondicao,
  NoCriarAlertaInterno,
  NoCriarPesquisa,
  NoEspera,
  NoFinalizar,
  NoFluxo,
  NoIniciarAgenteIA,
  NoMarcarPrioridade,
  NoMenu,
  NoMensagem,
  NoMudarStatus,
  NoPersistirRespostaPesquisa,
  NoRemoverEtiqueta,
  NoTransferirHumano,
  OperadorCondicao,
  TipoPesquisa,
} from "@/lib/fluxo-tipos";
import type { Etiqueta } from "@/lib/etiquetas";
import type { Atendente } from "@/lib/atendentes";
import type { AgenteIA } from "@/lib/agentes";
import { STATUS_CONFIG, STATUS_ORDEM } from "@/lib/status";
import { PRIORIDADE_CONFIG, PRIORIDADE_ORDEM } from "@/lib/prioridade";

type Aba = "no" | "gatilho";

const CLASSE_INPUT = "w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-teal-600 focus:outline-none";

function Campo({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>}
    </label>
  );
}

function AbaBotao({ label, ativa, onClick }: { label: string; ativa: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-2 py-1.5 text-xs font-medium ${
        ativa ? "border-teal-700 text-teal-800" : "border-transparent text-neutral-500 hover:text-neutral-700"
      }`}
    >
      {label}
    </button>
  );
}

function PropriedadesMensagem({ no, onAtualizar }: { no: NoMensagem; onAtualizar: (no: NoFluxo) => void }) {
  return (
    <Campo label="Texto da mensagem" hint="Variáveis: {nome}, {primeiro_nome}, {telefone} e as que você definir em Condição">
      <textarea value={no.texto} onChange={(e) => onAtualizar({ ...no, texto: e.target.value })} rows={6} className={CLASSE_INPUT} />
    </Campo>
  );
}

function PropriedadesEspera({ no, onAtualizar }: { no: NoEspera; onAtualizar: (no: NoFluxo) => void }) {
  return (
    <Campo label="Duração (segundos)">
      <input
        type="number"
        min={1}
        value={no.duracaoSegundos}
        onChange={(e) => onAtualizar({ ...no, duracaoSegundos: Math.max(1, Number(e.target.value) || 1) })}
        className={CLASSE_INPUT}
      />
    </Campo>
  );
}

const OPERADORES: { valor: OperadorCondicao; label: string }[] = [
  { valor: "igual", label: "igual a" },
  { valor: "diferente", label: "diferente de" },
  { valor: "contem", label: "contém" },
  { valor: "existe", label: "existe" },
  { valor: "nao_existe", label: "não existe" },
];

function PropriedadesCondicao({ no, onAtualizar }: { no: NoCondicao; onAtualizar: (no: NoFluxo) => void }) {
  const precisaValor = no.operador === "igual" || no.operador === "diferente" || no.operador === "contem";
  return (
    <div className="space-y-3">
      <Campo label="Variável" hint="Nome sem chaves, ex: especialidade">
        <input value={no.variavel} onChange={(e) => onAtualizar({ ...no, variavel: e.target.value })} className={CLASSE_INPUT} />
      </Campo>
      <Campo label="Operador">
        <select
          value={no.operador}
          onChange={(e) => onAtualizar({ ...no, operador: e.target.value as OperadorCondicao })}
          className={CLASSE_INPUT}
        >
          {OPERADORES.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.label}
            </option>
          ))}
        </select>
      </Campo>
      {precisaValor && (
        <Campo label="Valor de comparação">
          <input value={no.valor ?? ""} onChange={(e) => onAtualizar({ ...no, valor: e.target.value })} className={CLASSE_INPUT} />
        </Campo>
      )}
    </div>
  );
}

function PropriedadesFinalizar({ no, onAtualizar }: { no: NoFinalizar; onAtualizar: (no: NoFluxo) => void }) {
  return (
    <Campo label="Motivo (opcional)" hint="Aparece no histórico de execuções">
      <input
        value={no.motivo ?? ""}
        onChange={(e) => onAtualizar({ ...no, motivo: e.target.value || undefined })}
        className={CLASSE_INPUT}
      />
    </Campo>
  );
}

function PropriedadesAdicionarEtiqueta({
  no,
  etiquetas,
  onAtualizar,
}: {
  no: NoAdicionarEtiqueta | NoRemoverEtiqueta;
  etiquetas: Etiqueta[];
  onAtualizar: (no: NoFluxo) => void;
}) {
  return (
    <Campo label="Etiqueta" hint={etiquetas.length === 0 ? "Nenhuma etiqueta cadastrada ainda — crie uma em Ferramentas → Etiquetas" : undefined}>
      <select value={no.etiquetaId} onChange={(e) => onAtualizar({ ...no, etiquetaId: e.target.value })} className={CLASSE_INPUT}>
        <option value="">selecione...</option>
        {etiquetas.map((et) => (
          <option key={et.id} value={et.id}>
            {et.nome}
          </option>
        ))}
      </select>
    </Campo>
  );
}

function PropriedadesMudarStatus({ no, onAtualizar }: { no: NoMudarStatus; onAtualizar: (no: NoFluxo) => void }) {
  return (
    <Campo label="Novo status da conversa">
      <select value={no.status} onChange={(e) => onAtualizar({ ...no, status: e.target.value as NoMudarStatus["status"] })} className={CLASSE_INPUT}>
        {STATUS_ORDEM.map((s) => (
          <option key={s} value={s}>
            {STATUS_CONFIG[s].label}
          </option>
        ))}
      </select>
    </Campo>
  );
}

function PropriedadesMarcarPrioridade({ no, onAtualizar }: { no: NoMarcarPrioridade; onAtualizar: (no: NoFluxo) => void }) {
  return (
    <Campo label="Prioridade">
      <select
        value={no.prioridade}
        onChange={(e) => onAtualizar({ ...no, prioridade: e.target.value as NoMarcarPrioridade["prioridade"] })}
        className={CLASSE_INPUT}
      >
        {PRIORIDADE_ORDEM.map((p) => (
          <option key={p} value={p}>
            {PRIORIDADE_CONFIG[p].label}
          </option>
        ))}
      </select>
    </Campo>
  );
}

function PropriedadesAtribuirAtendente({
  no,
  atendentes,
  onAtualizar,
}: {
  no: NoAtribuirAtendente;
  atendentes: Atendente[];
  onAtualizar: (no: NoFluxo) => void;
}) {
  return (
    <Campo label="Atendente" hint="Deixe em branco pra desatribuir (tira quem estava responsável)">
      <select value={no.atendenteId ?? ""} onChange={(e) => onAtualizar({ ...no, atendenteId: e.target.value || null })} className={CLASSE_INPUT}>
        <option value="">(sem atendente)</option>
        {atendentes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nome}
          </option>
        ))}
      </select>
    </Campo>
  );
}

function PropriedadesTransferirHumano({ no, onAtualizar }: { no: NoTransferirHumano; onAtualizar: (no: NoFluxo) => void }) {
  return (
    <div className="space-y-3">
      <Campo label="Mensagem antes de transferir (opcional)" hint="Variáveis: {nome}, {primeiro_nome}, {telefone}">
        <textarea
          value={no.mensagem ?? ""}
          onChange={(e) => onAtualizar({ ...no, mensagem: e.target.value || undefined })}
          rows={3}
          className={CLASSE_INPUT}
        />
      </Campo>
      <Campo label="Motivo (opcional)" hint="Aparece no histórico de execuções">
        <input value={no.motivo ?? ""} onChange={(e) => onAtualizar({ ...no, motivo: e.target.value || undefined })} className={CLASSE_INPUT} />
      </Campo>
    </div>
  );
}

function PropriedadesCriarAlertaInterno({ no, onAtualizar }: { no: NoCriarAlertaInterno; onAtualizar: (no: NoFluxo) => void }) {
  return (
    <div className="space-y-3">
      <Campo label="Mensagem do alerta" hint="Variáveis: {nome}, {primeiro_nome}, {telefone} e as que você definir em Condição">
        <textarea value={no.mensagem} onChange={(e) => onAtualizar({ ...no, mensagem: e.target.value })} rows={4} className={CLASSE_INPUT} />
      </Campo>
      <Campo label="Números pra avisar" hint="WhatsApp, separados por vírgula (ex: 5561999998888, 5561988887777)">
        <input value={no.numeros} onChange={(e) => onAtualizar({ ...no, numeros: e.target.value })} className={CLASSE_INPUT} />
      </Campo>
    </div>
  );
}

function PropriedadesIniciarAgenteIA({
  no,
  agentes,
  onAtualizar,
}: {
  no: NoIniciarAgenteIA;
  agentes: AgenteIA[];
  onAtualizar: (no: NoFluxo) => void;
}) {
  return (
    <div className="space-y-3">
      <Campo label="Agente de IA" hint={agentes.length === 0 ? "Nenhum agente cadastrado ainda — crie um em Ferramentas → Agentes de IA" : undefined}>
        <select value={no.agenteId} onChange={(e) => onAtualizar({ ...no, agenteId: e.target.value })} className={CLASSE_INPUT}>
          <option value="">selecione...</option>
          {agentes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
              {a.ativo ? "" : " (inativo)"}
            </option>
          ))}
        </select>
      </Campo>
      <Campo label="Motivo (opcional)" hint="Aparece no histórico de execuções">
        <input value={no.motivo ?? ""} onChange={(e) => onAtualizar({ ...no, motivo: e.target.value || undefined })} className={CLASSE_INPUT} />
      </Campo>
    </div>
  );
}

function PropriedadesPausarAutomacao() {
  return <p className="text-sm text-neutral-500">Sem campos — impede o agente de IA de retomar esta conversa sozinho, sem encerrar o fluxo.</p>;
}

function PropriedadesMenu({ no, onAtualizar }: { no: NoMenu; onAtualizar: (no: NoFluxo) => void }) {
  return (
    <div className="space-y-3">
      <Campo label="Texto do menu">
        <textarea value={no.texto} onChange={(e) => onAtualizar({ ...no, texto: e.target.value })} rows={5} className={CLASSE_INPUT} />
      </Campo>

      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-600">Opções</span>
          <button type="button" onClick={() => onAtualizar(adicionarOpcaoMenu(no))} className="text-xs font-medium text-teal-700 hover:underline">
            + adicionar
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {no.opcoes.map((opcao, indice) => (
            <div key={indice} className="rounded-lg border border-neutral-200 p-2">
              <div className="flex gap-2">
                <input
                  value={opcao.valor}
                  onChange={(e) => {
                    const opcoes = no.opcoes.map((o, i) => (i === indice ? { ...o, valor: e.target.value } : o));
                    onAtualizar({ ...no, opcoes });
                  }}
                  placeholder="1"
                  className={`${CLASSE_INPUT} w-14`}
                />
                <input
                  value={opcao.rotulos.join(", ")}
                  onChange={(e) => {
                    const rotulos = e.target.value
                      .split(",")
                      .map((r) => r.trim())
                      .filter(Boolean);
                    const opcoes = no.opcoes.map((o, i) => (i === indice ? { ...o, rotulos: rotulos.length ? rotulos : [""] } : o));
                    onAtualizar({ ...no, opcoes });
                  }}
                  placeholder="rótulos aceitos, separados por vírgula"
                  className={`${CLASSE_INPUT} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => onAtualizar(removerOpcaoMenu(no, indice))}
                  disabled={no.opcoes.length <= 1}
                  className="rounded-lg border border-red-200 px-2 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  ×
                </button>
              </div>
              <p className="mt-1 text-[11px] text-neutral-400">o destino desta opção se conecta no canvas</p>
            </div>
          ))}
        </div>
      </div>

      <Campo label="Timeout, em segundos (opcional)" hint="Se não responder a tempo, segue pro caminho de timeout — conecte-o no canvas">
        <input
          type="number"
          min={1}
          value={no.timeoutSegundos ?? ""}
          onChange={(e) => onAtualizar({ ...no, timeoutSegundos: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })}
          className={CLASSE_INPUT}
        />
      </Campo>

      <Campo label="Mensagem se resposta inválida (opcional)">
        <input
          value={no.mensagemInvalida ?? ""}
          onChange={(e) => onAtualizar({ ...no, mensagemInvalida: e.target.value || undefined })}
          className={CLASSE_INPUT}
        />
      </Campo>
    </div>
  );
}

/**
 * Fase 3 (motor central de automação — ver _memoria/decisoes.md): entrada
 * aberta/validada, nunca "capturar_nps" — mesma família de campos de
 * PropriedadesMenu (texto, timeout), mais validação. Campos de min/max e
 * regex são MUTUAMENTE EXCLUSIVOS na UI (não só no schema): tipo numero
 * mostra min/max e esconde regex, tipo texto é o contrário — evita mostrar
 * configuração incompatível com o tipo escolhido.
 */
function PropriedadesCapturarResposta({ no, onAtualizar }: { no: NoCapturarResposta; onAtualizar: (no: NoFluxo) => void }) {
  return (
    <div className="space-y-3">
      <Campo label="Pergunta" hint="Variáveis: {nome}, {primeiro_nome}, {telefone} e as que você definir">
        <textarea value={no.texto} onChange={(e) => onAtualizar({ ...no, texto: e.target.value })} rows={4} className={CLASSE_INPUT} />
      </Campo>

      <Campo label="Variável" hint="Nome sem chaves, ex: nps_nota — é onde a resposta fica guardada pra usar depois">
        <input value={no.variavel} onChange={(e) => onAtualizar({ ...no, variavel: e.target.value })} className={CLASSE_INPUT} />
      </Campo>

      <Campo label="Tipo de resposta esperada">
        <select
          value={no.tipoValor}
          onChange={(e) => {
            const tipoValor = e.target.value as NoCapturarResposta["tipoValor"];
            // Troca de tipo limpa a configuração do tipo anterior — nunca
            // deixa min/max sobrando configurado pra um nó que virou texto,
            // nem regex sobrando pra um nó que virou número.
            onAtualizar(tipoValor === "numero" ? { ...no, tipoValor, regex: undefined } : { ...no, tipoValor, min: undefined, max: undefined });
          }}
          className={CLASSE_INPUT}
        >
          <option value="texto">Texto</option>
          <option value="numero">Número</option>
        </select>
      </Campo>

      {no.tipoValor === "numero" && (
        <div className="flex gap-3">
          <Campo label="Mínimo (opcional)">
            <input
              type="number"
              value={no.min ?? ""}
              onChange={(e) => onAtualizar({ ...no, min: e.target.value === "" ? undefined : Number(e.target.value) })}
              className={CLASSE_INPUT}
            />
          </Campo>
          <Campo label="Máximo (opcional)">
            <input
              type="number"
              value={no.max ?? ""}
              onChange={(e) => onAtualizar({ ...no, max: e.target.value === "" ? undefined : Number(e.target.value) })}
              className={CLASSE_INPUT}
            />
          </Campo>
        </div>
      )}

      {no.tipoValor === "texto" && (
        <Campo label="Formato aceito — regex (opcional)" hint="Só pra quem sabe o que é regex; deixe em branco pra aceitar qualquer texto">
          <input
            value={no.regex ?? ""}
            onChange={(e) => onAtualizar({ ...no, regex: e.target.value || undefined })}
            placeholder="ex: ^[0-9]{5}-?[0-9]{3}$"
            className={CLASSE_INPUT}
          />
        </Campo>
      )}

      <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
        <input type="checkbox" checked={no.obrigatorio !== false} onChange={(e) => onAtualizar({ ...no, obrigatorio: e.target.checked })} />
        Resposta obrigatória
      </label>

      <Campo label="Mensagem se resposta inválida (opcional)">
        <input
          value={no.mensagemValidacao ?? ""}
          onChange={(e) => onAtualizar({ ...no, mensagemValidacao: e.target.value || undefined })}
          className={CLASSE_INPUT}
        />
      </Campo>

      <Campo label="Máximo de tentativas inválidas (opcional)" hint="Padrão: 3">
        <input
          type="number"
          min={1}
          value={no.maxTentativasInvalidas ?? ""}
          onChange={(e) => onAtualizar({ ...no, maxTentativasInvalidas: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })}
          className={CLASSE_INPUT}
        />
      </Campo>

      <Campo label="Timeout, em segundos (opcional)" hint="Se não responder a tempo, segue pro caminho de timeout — conecte-o no canvas">
        <input
          type="number"
          min={1}
          value={no.timeoutSegundos ?? ""}
          onChange={(e) => onAtualizar({ ...no, timeoutSegundos: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })}
          className={CLASSE_INPUT}
        />
      </Campo>
    </div>
  );
}

const LABEL_TIPO_PESQUISA: Record<TipoPesquisa, string> = {
  nps: "NPS",
  satisfacao: "Satisfação",
  avaliacao_google: "Avaliação Google",
};

/**
 * Fase 3 — UX pensada pra quem opera a clínica, não pra quem programa: sem
 * JSON/UUID/payload à vista, só "tipo da pesquisa" e nomes de variável (o
 * mesmo conceito que Condição já usa). NPS/satisfação são pesquisa interna;
 * avaliação Google é solicitação externa — nunca a mesma coisa (ver
 * _memoria/decisoes.md).
 */
function PropriedadesCriarPesquisa({ no, onAtualizar }: { no: NoCriarPesquisa; onAtualizar: (no: NoFluxo) => void }) {
  return (
    <div className="space-y-3">
      <Campo label="Tipo da pesquisa">
        <select
          value={no.tipoPesquisa}
          onChange={(e) => onAtualizar({ ...no, tipoPesquisa: e.target.value as TipoPesquisa })}
          className={CLASSE_INPUT}
        >
          {(Object.keys(LABEL_TIPO_PESQUISA) as TipoPesquisa[]).map((tipo) => (
            <option key={tipo} value={tipo}>
              {LABEL_TIPO_PESQUISA[tipo]}
            </option>
          ))}
        </select>
      </Campo>

      <Campo label="Variável com o identificador da pesquisa" hint="Nome sem chaves, ex: pesquisa_id — use esse mesmo nome no bloco 'Salvar resposta da pesquisa'">
        <input value={no.variavelDestino} onChange={(e) => onAtualizar({ ...no, variavelDestino: e.target.value })} className={CLASSE_INPUT} />
      </Campo>

      <Campo label="Referência (opcional)" hint="Pra identificar depois a que atendimento/evento essa pesquisa se refere — aceita variáveis">
        <input
          value={no.referenciaId ?? ""}
          onChange={(e) => onAtualizar({ ...no, referenciaId: e.target.value || undefined })}
          className={CLASSE_INPUT}
        />
      </Campo>

      {no.tipoPesquisa === "avaliacao_google" && (
        <p className="text-[11px] text-neutral-400">
          Avaliação Google é uma solicitação externa — nunca vai gerar uma resposta gravada aqui dentro (ligue a um bloco &quot;Salvar resposta
          da pesquisa&quot; não faz sentido pra esse tipo).
        </p>
      )}
    </div>
  );
}

/** Fase 3 — único bloco que grava pesquisa_respostas, nunca o mesmo que cria (PropriedadesCriarPesquisa). */
function PropriedadesPersistirRespostaPesquisa({
  no,
  onAtualizar,
}: {
  no: NoPersistirRespostaPesquisa;
  onAtualizar: (no: NoFluxo) => void;
}) {
  return (
    <div className="space-y-3">
      <Campo label="Variável com o identificador da pesquisa" hint="O mesmo nome usado no bloco 'Criar pesquisa', ex: pesquisa_id">
        <input
          value={no.variavelPesquisaId}
          onChange={(e) => onAtualizar({ ...no, variavelPesquisaId: e.target.value })}
          className={CLASSE_INPUT}
        />
      </Campo>

      <Campo label="Variável com a resposta (nota ou texto)" hint="O nome usado no bloco 'Capturar resposta', ex: nps_nota">
        <input value={no.variavelValor} onChange={(e) => onAtualizar({ ...no, variavelValor: e.target.value })} className={CLASSE_INPUT} />
      </Campo>

      <Campo label="Variável com o comentário (opcional)" hint="Se você capturou um comentário extra em outro bloco 'Capturar resposta'">
        <input
          value={no.variavelComentario ?? ""}
          onChange={(e) => onAtualizar({ ...no, variavelComentario: e.target.value || undefined })}
          className={CLASSE_INPUT}
        />
      </Campo>
    </div>
  );
}

export function FluxoPainelPropriedades({
  noSelecionado,
  onAtualizarNo,
  gatilhoTipo,
  gatilhoPalavras,
  onMudarGatilho,
  etiquetas,
  atendentes,
  agentes,
}: {
  noSelecionado: NoFluxo | null;
  onAtualizarNo: (no: NoFluxo) => void;
  gatilhoTipo: string;
  gatilhoPalavras: string;
  onMudarGatilho: (tipo: string, palavras: string) => void;
  etiquetas: Etiqueta[];
  atendentes: Atendente[];
  agentes: AgenteIA[];
}) {
  const [aba, setAba] = useState<Aba>("no");

  return (
    <div className="p-3">
      <div className="mb-3 flex gap-1 border-b border-neutral-200">
        <AbaBotao label="Nó selecionado" ativa={aba === "no"} onClick={() => setAba("no")} />
        <AbaBotao label="Gatilho" ativa={aba === "gatilho"} onClick={() => setAba("gatilho")} />
      </div>

      {aba === "no" &&
        (noSelecionado ? (
          <div>
            <p className="mb-3 truncate text-[11px] font-mono text-neutral-400">{noSelecionado.id}</p>
            {noSelecionado.tipo === "mensagem" && <PropriedadesMensagem no={noSelecionado} onAtualizar={onAtualizarNo} />}
            {noSelecionado.tipo === "espera" && <PropriedadesEspera no={noSelecionado} onAtualizar={onAtualizarNo} />}
            {noSelecionado.tipo === "condicao" && <PropriedadesCondicao no={noSelecionado} onAtualizar={onAtualizarNo} />}
            {noSelecionado.tipo === "finalizar" && <PropriedadesFinalizar no={noSelecionado} onAtualizar={onAtualizarNo} />}
            {noSelecionado.tipo === "menu" && <PropriedadesMenu no={noSelecionado} onAtualizar={onAtualizarNo} />}
            {(noSelecionado.tipo === "adicionar_etiqueta" || noSelecionado.tipo === "remover_etiqueta") && (
              <PropriedadesAdicionarEtiqueta no={noSelecionado} etiquetas={etiquetas} onAtualizar={onAtualizarNo} />
            )}
            {noSelecionado.tipo === "mudar_status" && <PropriedadesMudarStatus no={noSelecionado} onAtualizar={onAtualizarNo} />}
            {noSelecionado.tipo === "marcar_prioridade" && <PropriedadesMarcarPrioridade no={noSelecionado} onAtualizar={onAtualizarNo} />}
            {noSelecionado.tipo === "atribuir_atendente" && (
              <PropriedadesAtribuirAtendente no={noSelecionado} atendentes={atendentes} onAtualizar={onAtualizarNo} />
            )}
            {noSelecionado.tipo === "transferir_humano" && <PropriedadesTransferirHumano no={noSelecionado} onAtualizar={onAtualizarNo} />}
            {noSelecionado.tipo === "criar_alerta_interno" && <PropriedadesCriarAlertaInterno no={noSelecionado} onAtualizar={onAtualizarNo} />}
            {noSelecionado.tipo === "pausar_automacao" && <PropriedadesPausarAutomacao />}
            {noSelecionado.tipo === "iniciar_agente_ia" && (
              <PropriedadesIniciarAgenteIA no={noSelecionado} agentes={agentes} onAtualizar={onAtualizarNo} />
            )}
            {noSelecionado.tipo === "capturar_resposta" && <PropriedadesCapturarResposta no={noSelecionado} onAtualizar={onAtualizarNo} />}
            {noSelecionado.tipo === "criar_pesquisa" && <PropriedadesCriarPesquisa no={noSelecionado} onAtualizar={onAtualizarNo} />}
            {noSelecionado.tipo === "persistir_resposta_pesquisa" && (
              <PropriedadesPersistirRespostaPesquisa no={noSelecionado} onAtualizar={onAtualizarNo} />
            )}
            {noSelecionado.tipo === "inicio" && (
              <p className="text-sm text-neutral-500">O nó de início não tem campos — configure o gatilho na aba ao lado.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Clique num nó do canvas pra editar suas propriedades.</p>
        ))}

      {aba === "gatilho" && (
        <div className="space-y-3">
          <Campo label="Tipo de gatilho" hint="Define quando este fluxo começa sozinho, ao publicar">
            <select value={gatilhoTipo} onChange={(e) => onMudarGatilho(e.target.value, gatilhoPalavras)} className={CLASSE_INPUT}>
              <option value="manual">Manual (só por teste, sem gatilho automático)</option>
              <option value="nova_conversa">Nova conversa</option>
              <option value="primeira_mensagem">Primeira mensagem</option>
              <option value="palavra_chave">Palavra-chave</option>
              <option value="solicitacao_avaliacao_google">Solicitação de avaliação Google (evento interno)</option>
            </select>
          </Campo>
          {gatilhoTipo === "palavra_chave" && (
            <Campo label="Palavras-chave" hint="separadas por vírgula — o casamento ignora acento e maiúscula/minúscula">
              <input value={gatilhoPalavras} onChange={(e) => onMudarGatilho(gatilhoTipo, e.target.value)} className={CLASSE_INPUT} />
            </Campo>
          )}
        </div>
      )}
    </div>
  );
}
