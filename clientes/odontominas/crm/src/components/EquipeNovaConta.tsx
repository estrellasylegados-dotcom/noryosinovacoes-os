"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Perfil } from "@/lib/permissoes";

const MENSAGEM_ERRO: Record<string, string> = {
  nome_obrigatorio: "Informe o nome.",
  email_invalido: "Informe um e-mail válido.",
  email_ja_existe: "Já existe uma conta com esse e-mail.",
  perfil_invalido: "Perfil inválido.",
  perfil_nao_permitido: "Você não pode atribuir esse perfil.",
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

/** Convite por e-mail (seções 17/25/26 do pedido) — substitui a criação com senha temporária: a pessoa define a própria senha ao aceitar o convite. */
export function EquipeNovaConta({ perfisAtribuiveis }: { perfisAtribuiveis: Perfil[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState<Perfil | "">(perfisAtribuiveis[0] ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function reset() {
    setNome("");
    setEmail("");
    setPerfil(perfisAtribuiveis[0] ?? "");
    setErro(null);
  }

  async function convidar() {
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/equipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, perfil }),
      });
      const resultado = (await resposta.json()) as { ok: boolean; error?: string; emailEnviado?: boolean };
      if (!resultado.ok) {
        setErro((resultado.error && MENSAGEM_ERRO[resultado.error]) || "Não deu pra convidar.");
        return;
      }
      reset();
      setAberto(false);
      router.refresh();
      if (!resultado.emailEnviado) {
        window.alert("Conta criada, mas o e-mail de convite não foi enviado (Resend ainda não configurado nesta instância) — use \"Reenviar convite\" depois de configurar.");
      }
    } finally {
      setSalvando(false);
    }
  }

  if (perfisAtribuiveis.length === 0) return null;

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white"
      >
        + Convidar
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
          <label className="mb-1 block text-xs font-medium text-neutral-600">E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={CLASSE_INPUT} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Perfil</label>
          <select value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)} className={CLASSE_INPUT}>
            {perfisAtribuiveis.map((p) => (
              <option key={p} value={p}>
                {LABEL_PERFIL[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={convidar}
          disabled={salvando}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {salvando ? "Enviando…" : "Enviar convite"}
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
        A pessoa recebe um e-mail com um link pra criar a própria senha. O convite expira em 24 horas.
      </p>
    </div>
  );
}
