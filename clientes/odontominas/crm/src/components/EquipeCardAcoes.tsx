"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Perfil } from "@/lib/permissoes";
import type { StatusAtendente } from "@/lib/atendentes";

const MENSAGEM_ERRO: Record<string, string> = {
  nome_obrigatorio: "Informe o nome.",
  perfil_invalido: "Perfil inválido.",
  perfil_nao_permitido: "Você não pode atribuir esse perfil.",
  status_invalido: "Status inválido.",
  senha_muito_curta: "A senha precisa ter pelo menos 8 caracteres.",
  ultima_dona: "Essa é a única Dona ativa — promova outra pessoa a Dona antes de mudar esta conta.",
  not_found: "Conta não encontrada.",
  nao_pode_editar_a_propria_conta: "Você não pode editar a própria conta por aqui.",
  conta_ja_ativa: "Essa conta já está ativa.",
  sem_email: "Essa conta não tem e-mail cadastrado.",
};

const LABEL_PERFIL: Record<Perfil, string> = {
  noryos_admin: "Noryos Admin",
  noryos_suporte: "Noryos Suporte",
  dona: "Dona",
  gerente: "Gerente",
  supervisora: "Supervisora",
  atendente: "Atendente",
};

const CLASSE_INPUT = "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm";

export function EquipeCardAcoes({
  id,
  nome,
  perfil,
  status,
  perfisAtribuiveis,
}: {
  id: string;
  nome: string;
  perfil: Perfil;
  status: StatusAtendente;
  perfisAtribuiveis: Perfil[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [novoNome, setNovoNome] = useState(nome);
  const [novoPerfil, setNovoPerfil] = useState<Perfil>(perfil);
  const [novaSenha, setNovaSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  function mensagemErro(codigo?: string): string {
    return (codigo && MENSAGEM_ERRO[codigo]) || "Não deu pra salvar.";
  }

  async function patch(body: Record<string, unknown>) {
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/equipe/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const resultado = (await resposta.json()) as { ok: boolean; error?: string };
      if (!resultado.ok) {
        setErro(mensagemErro(resultado.error));
        return;
      }
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  async function salvarEdicao() {
    await patch({ nome: novoNome, perfil: novoPerfil });
    setEditando(false);
  }

  async function reenviarConvite() {
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const resposta = await fetch(`/api/equipe/${id}/convite`, { method: "POST" });
      const resultado = (await resposta.json()) as { ok: boolean; error?: string; emailEnviado?: boolean };
      if (!resultado.ok) {
        setErro(mensagemErro(resultado.error));
        return;
      }
      setSucesso(resultado.emailEnviado ? "Convite reenviado." : "Convite recriado, mas o e-mail não saiu (Resend não configurado).");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarNovaSenha() {
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const resposta = await fetch(`/api/equipe/${id}/senha`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaSenha }),
      });
      const resultado = (await resposta.json()) as { ok: boolean; error?: string };
      if (!resultado.ok) {
        setErro(mensagemErro(resultado.error));
        return;
      }
      setSucesso("Senha atualizada e sessões da conta encerradas — avise a pessoa por fora.");
      setNovaSenha("");
      setTrocandoSenha(false);
    } finally {
      setSalvando(false);
    }
  }

  const perfisSelecionaveis = perfisAtribuiveis.includes(perfil) ? perfisAtribuiveis : [perfil, ...perfisAtribuiveis];

  return (
    <div className="mt-4 space-y-2 border-t border-neutral-100 pt-3">
      <div className="flex flex-wrap gap-2">
        {status === "invited" ? (
          <button
            type="button"
            onClick={reenviarConvite}
            disabled={salvando}
            className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            Reenviar convite
          </button>
        ) : status === "active" ? (
          <button
            type="button"
            onClick={() => patch({ status: "blocked" })}
            disabled={salvando}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
          >
            Bloquear
          </button>
        ) : (
          <button
            type="button"
            onClick={() => patch({ status: "active" })}
            disabled={salvando}
            className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            Reativar
          </button>
        )}

        {status !== "invited" && (
          <button
            type="button"
            onClick={() => patch({ status: "disabled" })}
            disabled={salvando || status === "disabled"}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
          >
            Desativar
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setTrocandoSenha(false);
            setEditando((v) => !v);
          }}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        >
          Editar
        </button>

        {status === "active" && (
          <button
            type="button"
            onClick={() => {
              setEditando(false);
              setTrocandoSenha((v) => !v);
            }}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
          >
            Redefinir senha
          </button>
        )}
      </div>

      {editando && (
        <div className="space-y-2 rounded-lg bg-neutral-50 p-3">
          <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className={CLASSE_INPUT} />
          <select value={novoPerfil} onChange={(e) => setNovoPerfil(e.target.value as Perfil)} className={CLASSE_INPUT}>
            {perfisSelecionaveis.map((p) => (
              <option key={p} value={p}>
                {LABEL_PERFIL[p]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={salvarEdicao}
            disabled={salvando}
            className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      )}

      {trocandoSenha && (
        <div className="space-y-2 rounded-lg bg-neutral-50 p-3">
          <input
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            placeholder="Nova senha"
            className={CLASSE_INPUT}
          />
          <button
            type="button"
            onClick={salvarNovaSenha}
            disabled={salvando}
            className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Redefinir senha
          </button>
        </div>
      )}

      {sucesso && <p className="text-xs font-medium text-teal-700">{sucesso}</p>}
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
