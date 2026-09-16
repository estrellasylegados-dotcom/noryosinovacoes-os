"use client";

import Link from "next/link";
import { useState } from "react";

type ResultadoAcao = { mensagem: string; tom: "info" | "erro" | "sucesso" } | null;

export function ControleOdontoAcoes() {
  const [carregando, setCarregando] = useState<"teste" | "sync" | null>(null);
  const [resultado, setResultado] = useState<ResultadoAcao>(null);

  async function testarConexao() {
    setCarregando("teste");
    setResultado(null);
    try {
      const res = await fetch("/api/integrations/controle-odonto/test", { method: "POST" });
      const corpo = await res.json();
      setResultado({
        mensagem: corpo.mensagem ?? `status: ${corpo.status ?? "desconhecido"}`,
        tom: corpo.status === "conectada" ? "sucesso" : "info",
      });
    } catch {
      setResultado({ mensagem: "Não consegui testar a conexão agora.", tom: "erro" });
    } finally {
      setCarregando(null);
    }
  }

  async function sincronizarAgora() {
    setCarregando("sync");
    setResultado(null);
    try {
      const res = await fetch("/api/integrations/controle-odonto/sync", { method: "POST" });
      const corpo = await res.json();
      setResultado({
        mensagem: corpo.ok
          ? `Sincronizado: ${corpo.quantidade ?? 0} registro(s).`
          : corpo.status === "aguardando_credencial"
            ? "Ainda aguardando credencial/documentação confirmada — nenhuma chamada foi feita."
            : corpo.status === "ocupado"
              ? "Já existe uma sincronização em andamento — tenta de novo em instantes."
              : `Não sincronizou agora (${corpo.status ?? corpo.error ?? "erro"}).`,
        tom: corpo.ok ? "sucesso" : "info",
      });
    } catch {
      setResultado({ mensagem: "Não consegui sincronizar agora.", tom: "erro" });
    } finally {
      setCarregando(null);
    }
  }

  return (
    <div className="mt-5 border-t border-neutral-100 pt-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={testarConexao}
          disabled={carregando !== null}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-60"
        >
          {carregando === "teste" ? "Testando…" : "Testar conexão"}
        </button>
        <button
          type="button"
          onClick={sincronizarAgora}
          disabled={carregando !== null}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {carregando === "sync" ? "Sincronizando…" : "Sincronizar agora"}
        </button>
        <Link
          href="/integracoes/controle-odonto/logs"
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
        >
          Ver logs
        </Link>
      </div>

      {resultado && (
        <p
          className={`mt-3 rounded-lg p-3 text-sm ${
            resultado.tom === "sucesso"
              ? "bg-emerald-50 text-emerald-700"
              : resultado.tom === "erro"
                ? "bg-red-50 text-red-700"
                : "bg-neutral-50 text-neutral-600"
          }`}
        >
          {resultado.mensagem}
        </p>
      )}
    </div>
  );
}
