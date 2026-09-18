"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MENSAGEM_ERRO: Record<string, string> = {
  nome_obrigatorio: "Informe o nome.",
  usuario_obrigatorio: "Informe o usuário de login.",
  usuario_invalido: "Usuário só pode ter letras minúsculas, números, ponto, hífen e underline.",
  usuario_ja_existe: "Já existe uma conta com esse usuário.",
  senha_muito_curta: "A senha precisa ter pelo menos 8 caracteres.",
  papel_invalido: "Papel inválido.",
};

const CLASSE_INPUT = "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm";

/** Cria conta de atendente direto pela UI — substitui o INSERT manual via SQL/MCP que era o único jeito até aqui. */
export function EquipeNovaConta() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<"admin" | "atendente">("atendente");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function reset() {
    setNome("");
    setUsuario("");
    setSenha("");
    setPapel("atendente");
    setErro(null);
  }

  async function criar() {
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/equipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, usuario, senha, papel }),
      });
      const resultado = (await resposta.json()) as { ok: boolean; error?: string };
      if (!resultado.ok) {
        setErro((resultado.error && MENSAGEM_ERRO[resultado.error]) || "Não deu pra criar a conta.");
        return;
      }
      reset();
      setAberto(false);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white"
      >
        + Nova conta
      </button>
    );
  }

  return (
    <div className="mb-6 space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={CLASSE_INPUT} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Usuário (login)</label>
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} className={CLASSE_INPUT} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Senha temporária</label>
          <input value={senha} onChange={(e) => setSenha(e.target.value)} className={CLASSE_INPUT} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Papel</label>
          <select
            value={papel}
            onChange={(e) => setPapel(e.target.value as "admin" | "atendente")}
            className={CLASSE_INPUT}
          >
            <option value="atendente">Atendente</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={criar}
          disabled={salvando}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {salvando ? "Criando…" : "Criar conta"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setAberto(false);
          }}
          className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100"
        >
          Cancelar
        </button>
        {erro && <span className="text-xs text-red-600">{erro}</span>}
      </div>

      <p className="text-xs text-neutral-400">
        Avise a pessoa da senha temporária por fora (WhatsApp/e-mail) — convite automático por e-mail ainda não existe.
      </p>
    </div>
  );
}
