"use client";

import { useState, type ReactNode } from "react";
import { adicionarOpcaoMenu, removerOpcaoMenu } from "@/lib/fluxo-editor-grafo";
import type {
  NoAdicionarEtiqueta,
  NoAtribuirAtendente,
  NoCondicao,
  NoEspera,
  NoFinalizar,
  NoFluxo,
  NoMarcarPrioridade,
  NoMenu,
  NoMensagem,
  NoMudarStatus,
  NoRemoverEtiqueta,
  OperadorCondicao,
} from "@/lib/fluxo-tipos";
import type { Etiqueta } from "@/lib/etiquetas";
import type { Atendente } from "@/lib/atendentes";
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

export function FluxoPainelPropriedades({
  noSelecionado,
  onAtualizarNo,
  gatilhoTipo,
  gatilhoPalavras,
  onMudarGatilho,
  etiquetas,
  atendentes,
}: {
  noSelecionado: NoFluxo | null;
  onAtualizarNo: (no: NoFluxo) => void;
  gatilhoTipo: string;
  gatilhoPalavras: string;
  onMudarGatilho: (tipo: string, palavras: string) => void;
  etiquetas: Etiqueta[];
  atendentes: Atendente[];
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
