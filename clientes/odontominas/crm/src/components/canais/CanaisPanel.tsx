"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDataHora, formatTelefone } from "@/lib/tempo";
import type { CanalPublico, StatusCanal } from "@/lib/canais";

export type CanalView = CanalPublico & { instancia: string | null };

const STATUS_VISUAL: Record<StatusCanal, { rotulo: string; ponto: string; badge: string }> = {
  connected: { rotulo: "Conectado", ponto: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  connecting: { rotulo: "Conectando", ponto: "bg-amber-500", badge: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  disconnected: { rotulo: "Desconectado", ponto: "bg-red-500", badge: "bg-red-50 text-red-700 ring-red-600/20" },
  error: { rotulo: "Com erro", ponto: "bg-red-500", badge: "bg-red-50 text-red-700 ring-red-600/20" },
  unknown: { rotulo: "Sem status", ponto: "bg-neutral-300", badge: "bg-neutral-100 text-neutral-500 ring-neutral-500/20" },
};

async function chamar<T = { ok: boolean; error?: string }>(url: string, init?: RequestInit): Promise<T & { ok: boolean; error?: string }> {
  try {
    const resposta = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    return (await resposta.json()) as T & { ok: boolean; error?: string };
  } catch {
    return { ok: false, error: "request_error" } as T & { ok: boolean; error?: string };
  }
}

const MENSAGENS_ERRO: Record<string, string> = {
  canal_principal_nao_pode_pausar: "O canal principal não pode ser pausado. Marque outro canal como principal antes.",
  instancia_ja_cadastrada: "Essa instância já está cadastrada.",
  instancia_invalida: "Nome de instância inválido.",
  nome_vazio: "Informe um nome.",
  forbidden: "Seu perfil não tem permissão para isso.",
};

export function CanaisPanel({
  canais,
  podeConfigurar,
  podeConectar,
  podeDesconectar,
  destaqueId = null,
}: {
  /** Link direto (ex.: alerta → "Abrir canal"): destaca e rola até este canal. */
  destaqueId?: string | null;
  canais: CanalView[];
  podeConfigurar: boolean;
  podeConectar: boolean;
  podeDesconectar: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [editando, setEditando] = useState<CanalView | null>(null);
  const [qr, setQr] = useState<{ canal: CanalView; dataUrl: string | null; conectado: boolean; erro: string | null } | null>(null);
  const [diagnostico, setDiagnostico] = useState<{ canal: CanalView; texto: string } | null>(null);
  const [adicionando, setAdicionando] = useState(false);

  async function executar(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setOcupado(id);
    setErro(null);
    const r = await fn();
    setOcupado(null);
    if (!r.ok) setErro(MENSAGENS_ERRO[r.error ?? ""] ?? "Não foi possível concluir. Tente de novo.");
    else router.refresh();
  }

  async function conectar(canal: CanalView) {
    setOcupado(canal.id);
    const r = await chamar<{ conectado: boolean; qrDataUrl: string | null; erro: string | null }>(`/api/canais/${canal.id}/conectar`, { method: "POST" });
    setOcupado(null);
    setQr({ canal, dataUrl: r.qrDataUrl ?? null, conectado: r.conectado === true, erro: r.ok ? null : (r.erro ?? "Não consegui gerar o QR agora.") });
    if (r.conectado) router.refresh();
  }

  async function diagnosticar(canal: CanalView) {
    setOcupado(canal.id);
    const r = await chamar<{
      saude: { status: StatusCanal; lastWebhookAt: string | null; lastMessageInAt: string | null; lastMessageOutAt: string | null; lastError: string | null };
      tecnico: { provider: string; tipo: string; instancia: string } | null;
    }>(`/api/canais/${canal.id}/diagnostico`);
    setOcupado(null);
    if (!r.ok) return setErro("Não foi possível diagnosticar agora.");
    const s = r.saude;
    setDiagnostico({
      canal,
      texto: [
        `Status ao vivo: ${STATUS_VISUAL[s.status].rotulo}`,
        `Último webhook: ${formatDataHora(s.lastWebhookAt)}`,
        `Última mensagem recebida: ${formatDataHora(s.lastMessageInAt)}`,
        `Última mensagem enviada: ${formatDataHora(s.lastMessageOutAt)}`,
        `Último erro: ${s.lastError ?? "nenhum"}`,
        ...(r.tecnico ? [`Provider: ${r.tecnico.provider} · Instância: ${r.tecnico.instancia}`] : []),
      ].join("\n"),
    });
  }

  return (
    <div className="space-y-4">
      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {canais.length === 0 && (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          Nenhum canal cadastrado ainda.
        </p>
      )}

      {canais.map((canal) => {
        const visual = STATUS_VISUAL[canal.status];
        const trabalhando = ocupado === canal.id;
        return (
          <section
            key={canal.id}
            id={`canal-${canal.id}`}
            ref={canal.id === destaqueId ? (el) => el?.scrollIntoView({ block: "center" }) : undefined}
            className={`rounded-xl border bg-white p-5 ${canal.id === destaqueId ? "border-teal-500 ring-2 ring-teal-200" : canal.ativo ? "border-neutral-200" : "border-neutral-200 opacity-80"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${visual.ponto}`} />
                  <h2 className="truncate text-sm font-semibold text-neutral-900">{canal.nome}</h2>
                  {canal.principal && (
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20">Principal</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {canal.tipo === "whatsapp" ? "WhatsApp" : canal.tipo}
                  {canal.telefone ? ` · ${formatTelefone(canal.telefone)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${visual.badge}`}>{visual.rotulo}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                    canal.ativo ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-amber-50 text-amber-700 ring-amber-600/20"
                  }`}
                >
                  {canal.ativo ? "Ativo" : "Pausado"}
                </span>
              </div>
            </div>

            {canal.instancia && <p className="mt-2 text-[11px] text-neutral-400">Instância: {canal.instancia}</p>}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
              {podeConfigurar && (
                <Botao onClick={() => setEditando(canal)} disabled={trabalhando}>Editar nome</Botao>
              )}
              {podeConfigurar && (
                <Botao
                  onClick={() => executar(canal.id, () => chamar(`/api/canais/${canal.id}`, { method: "PATCH", body: JSON.stringify({ ativo: !canal.ativo }) }))}
                  disabled={trabalhando}
                >
                  {canal.ativo ? "Pausar" : "Ativar"}
                </Botao>
              )}
              {podeConfigurar && !canal.principal && canal.ativo && (
                <Botao onClick={() => executar(canal.id, () => chamar(`/api/canais/${canal.id}/principal`, { method: "POST" }))} disabled={trabalhando}>
                  Tornar principal
                </Botao>
              )}
              {podeConectar && canal.status !== "connected" && (
                <Botao onClick={() => conectar(canal)} disabled={trabalhando}>Conectar / reconectar</Botao>
              )}
              {podeDesconectar && canal.status === "connected" && (
                <Botao
                  perigo
                  onClick={() => {
                    if (window.confirm("Desconectar derruba o WhatsApp deste canal até reconectar com um novo QR. Continuar?")) {
                      executar(canal.id, () => chamar(`/api/canais/${canal.id}/desconectar`, { method: "POST" }));
                    }
                  }}
                  disabled={trabalhando}
                >
                  Desconectar
                </Botao>
              )}
              <Botao onClick={() => diagnosticar(canal)} disabled={trabalhando}>Diagnosticar</Botao>
            </div>
          </section>
        );
      })}

      {podeConfigurar && (
        <button
          type="button"
          onClick={() => setAdicionando(true)}
          className="w-full rounded-xl border border-dashed border-neutral-300 bg-white py-3 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
        >
          + Adicionar canal
        </button>
      )}

      {editando && (
        <Modal titulo="Editar nome do canal" onFechar={() => setEditando(null)}>
          <FormNome
            inicial={editando.nome}
            rotulo="Salvar"
            onEnviar={async (nome) => {
              const r = await chamar(`/api/canais/${editando.id}`, { method: "PATCH", body: JSON.stringify({ nome }) });
              if (r.ok) {
                setEditando(null);
                router.refresh();
              }
              return r.ok ? null : (MENSAGENS_ERRO[r.error ?? ""] ?? "Não foi possível salvar.");
            }}
          />
        </Modal>
      )}

      {adicionando && (
        <Modal titulo="Adicionar canal WhatsApp" onFechar={() => setAdicionando(false)}>
          <FormNovoCanal
            onCriado={() => {
              setAdicionando(false);
              router.refresh();
            }}
          />
        </Modal>
      )}

      {qr && (
        <Modal titulo={`Conectar ${qr.canal.nome}`} onFechar={() => { setQr(null); router.refresh(); }}>
          {qr.conectado ? (
            <p className="text-sm text-emerald-700">Este canal já está conectado.</p>
          ) : qr.dataUrl ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-center text-sm text-neutral-600">
                No celular do número: WhatsApp → Aparelhos conectados → Conectar aparelho, e escaneie o código.
              </p>
              {/* Data URI vindo da Evolution API — não dá pra otimizar via next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.dataUrl} alt="QR Code de conexão do WhatsApp" className="h-56 w-56 rounded-lg border border-neutral-200" />
            </div>
          ) : (
            <p className="text-sm text-neutral-600">{qr.erro === "nao_configurado" ? "Evolution API não configurada neste ambiente." : "Não consegui gerar o QR Code agora. Tente de novo em alguns segundos."}</p>
          )}
        </Modal>
      )}

      {diagnostico && (
        <Modal titulo={`Diagnóstico · ${diagnostico.canal.nome}`} onFechar={() => setDiagnostico(null)}>
          <pre className="whitespace-pre-wrap text-xs text-neutral-700">{diagnostico.texto}</pre>
        </Modal>
      )}
    </div>
  );
}

function Botao({ children, onClick, disabled, perigo }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; perigo?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
        perigo ? "border-red-200 text-red-600 hover:bg-red-50" : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
      }`}
    >
      {children}
    </button>
  );
}

function Modal({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar}>
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">{titulo}</h3>
          <button type="button" onClick={onFechar} className="text-neutral-400 hover:text-neutral-600" aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormNome({ inicial, rotulo, onEnviar }: { inicial: string; rotulo: string; onEnviar: (nome: string) => Promise<string | null> }) {
  const [nome, setNome] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        setErro(await onEnviar(nome));
        setEnviando(false);
      }}
    >
      <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} placeholder="Ex.: WhatsApp Recepção" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
      <p className="text-xs text-neutral-400">Só um nome pra vocês reconhecerem aqui no CRM — não muda o perfil real do WhatsApp.</p>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <button type="submit" disabled={enviando} className="w-full rounded-lg bg-teal-700 py-2 text-sm font-medium text-white disabled:opacity-60">{rotulo}</button>
    </form>
  );
}

function FormNovoCanal({ onCriado }: { onCriado: () => void }) {
  const [nome, setNome] = useState("");
  const [instancia, setInstancia] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        const r = await chamar("/api/canais", { method: "POST", body: JSON.stringify({ nome, providerInstanceId: instancia }) });
        setEnviando(false);
        if (r.ok) onCriado();
        else setErro(MENSAGENS_ERRO[r.error ?? ""] ?? "Não foi possível criar o canal.");
      }}
    >
      <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} placeholder="Nome (ex.: WhatsApp Comercial)" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
      <input value={instancia} onChange={(e) => setInstancia(e.target.value)} placeholder="Instância na Evolution API" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
      <p className="text-xs text-neutral-400">A instância precisa já existir na Evolution API, com o webhook apontando para este CRM. Depois de criar, use &quot;Conectar&quot; para ler o QR.</p>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <button type="submit" disabled={enviando || !nome.trim() || !instancia.trim()} className="w-full rounded-lg bg-teal-700 py-2 text-sm font-medium text-white disabled:opacity-60">Criar canal</button>
    </form>
  );
}
