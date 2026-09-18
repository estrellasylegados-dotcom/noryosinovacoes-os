"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Papel } from "@/lib/sessao";

const MENSAGEM_ERRO: Record<string, string> = {
  nome_obrigatorio: "Informe o nome.",
  papel_invalido: "Papel inválido.",
  senha_muito_curta: "A senha precisa ter pelo menos 8 caracteres.",
  ultimo_admin: "Essa é a única conta admin ativa — promova outra pessoa a admin antes de desativar ou rebaixar esta.",
  not_found: "Conta não encontrada.",
};

const CLASSE_INPUT = "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm";

export function EquipeCardAcoes({
  id,
  nome,
  papel,
  ativo,
}: {
  id: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [novoNome, setNovoNome] = useState(nome);
  const [novoPapel, setNovoPapel] = useState<Papel>(papel);
  const [novaSenha, setNovaSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  function mensagemErro(codigo?: string): string {
    return (codigo && MENSAGEM_ERRO[codigo]) || "Não deu pra salvar.";
  }

  async function alternarAtivo() {
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/equipe/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !ativo }),
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
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/equipe/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: novoNome, papel: novoPapel }),
      });
      const resultado = (await resposta.json()) as { ok: boolean; error?: string };
      if (!resultado.ok) {
        setErro(mensagemErro(resultado.error));
        return;
      }
      setEditando(false);
      router.refresh();
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
      setSucesso("Senha atualizada — avise a pessoa por fora.");
      setNovaSenha("");
      setTrocandoSenha(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-4 space-y-2 border-t border-neutral-100 pt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={alternarAtivo}
          disabled={salvando}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
            ativo ? "border border-neutral-200 text-neutral-600 hover:bg-neutral-100" : "bg-teal-700 text-white"
          }`}
        >
          {ativo ? "Desativar" : "Ativar"}
        </button>
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
        <button
          type="button"
          onClick={() => {
            setEditando(false);
            setTrocandoSenha((v) => !v);
          }}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        >
          Trocar senha
        </button>
      </div>

      {editando && (
        <div className="space-y-2 rounded-lg bg-neutral-50 p-3">
          <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className={CLASSE_INPUT} />
          <select value={novoPapel} onChange={(e) => setNovoPapel(e.target.value as Papel)} className={CLASSE_INPUT}>
            <option value="atendente">Atendente</option>
            <option value="admin">Admin</option>
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
            placeholder="Nova senha temporária"
            className={CLASSE_INPUT}
          />
          <button
            type="button"
            onClick={salvarNovaSenha}
            disabled={salvando}
            className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Trocar senha
          </button>
        </div>
      )}

      {sucesso && <p className="text-xs font-medium text-teal-700">{sucesso}</p>}
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
