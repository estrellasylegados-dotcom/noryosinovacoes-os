"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

const MENSAGEM_ERRO: Record<string, string> = {
  senha_muito_curta: "A senha precisa ter pelo menos 8 caracteres.",
  token_invalido: "Convite inválido.",
  token_ja_usado: "Este convite já foi usado.",
  token_expirado: "Este convite expirou (validade de 24 horas) — peça pra reenviarem.",
};

export function AceitarConviteForm({ token }: { token: string }) {
  const [novaSenha, setNovaSenha] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/convite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaSenha }),
      });
      const resultado = (await resposta.json()) as { ok: boolean; error?: string };
      if (!resultado.ok) {
        setErro((resultado.error && MENSAGEM_ERRO[resultado.error]) || "Não deu pra aceitar o convite.");
        return;
      }
      setSucesso(true);
    } finally {
      setSalvando(false);
    }
  }

  if (sucesso) {
    return (
      <div className="w-full max-w-xs space-y-3 text-center">
        <p className="text-sm text-neutral-700">Conta ativada.</p>
        <Link href="/login" className="text-sm text-teal-700 hover:underline">
          Entrar agora
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Criar minha senha</h1>
        <p className="text-sm text-neutral-500">Você foi convidado para acessar o Noryos. Escolha uma senha (pelo menos 8 caracteres).</p>
      </div>
      <input
        type="password"
        value={novaSenha}
        onChange={(e) => setNovaSenha(e.target.value)}
        placeholder="Nova senha"
        autoFocus
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
      />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button
        type="submit"
        disabled={salvando || novaSenha.length < 8}
        className="w-full rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-800 disabled:opacity-50"
      >
        {salvando ? "Salvando..." : "Criar minha senha"}
      </button>
    </form>
  );
}
