"use client";

import Link from "next/link";
import type { StatusFluxo, StatusVersaoFluxo } from "@/lib/fluxo-versoes";

const CORES_STATUS: Record<StatusFluxo, string> = {
  ativo: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  pausado: "bg-amber-50 text-amber-700 ring-amber-600/20",
  arquivado: "bg-neutral-100 text-neutral-500 ring-neutral-500/20",
};

const LABEL_STATUS: Record<StatusFluxo, string> = { ativo: "Ativo", pausado: "Pausado", arquivado: "Arquivado" };

function textoAutosave(salvando: boolean, erro: boolean, ultimoSalvoEm: string | null): string {
  if (erro) return "Falha ao salvar";
  if (salvando) return "Salvando…";
  if (!ultimoSalvoEm) return "";
  return `Salvo às ${new Date(ultimoSalvoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export function FluxoBarraAcoes({
  nome,
  onMudarNome,
  status,
  versaoStatus,
  versaoNumero,
  salvando,
  erroSalvar,
  ultimoSalvoEm,
  podeDesfazer,
  podeRefazer,
  onDesfazer,
  onRefazer,
  podePublicar,
  publicando,
  onPublicar,
}: {
  nome: string;
  onMudarNome: (nome: string) => void;
  status: StatusFluxo;
  versaoStatus: StatusVersaoFluxo;
  versaoNumero: number;
  salvando: boolean;
  erroSalvar: boolean;
  ultimoSalvoEm: string | null;
  podeDesfazer: boolean;
  podeRefazer: boolean;
  onDesfazer: () => void;
  onRefazer: () => void;
  podePublicar: boolean;
  publicando: boolean;
  onPublicar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2.5">
      <Link href="/fluxos" className="text-sm text-neutral-400 hover:text-neutral-600">
        ← Fluxos
      </Link>
      <input
        value={nome}
        onChange={(e) => onMudarNome(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-sm font-medium text-neutral-900 hover:border-neutral-200 focus:border-teal-600 focus:outline-none"
      />
      <div className="flex gap-1">
        <button
          type="button"
          disabled={!podeDesfazer}
          onClick={onDesfazer}
          title="Desfazer (Ctrl+Z)"
          className="rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
        >
          ↶
        </button>
        <button
          type="button"
          disabled={!podeRefazer}
          onClick={onRefazer}
          title="Refazer (Ctrl+Shift+Z)"
          className="rounded-lg border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
        >
          ↷
        </button>
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${CORES_STATUS[status]}`}>{LABEL_STATUS[status]}</span>
      <span className="text-xs text-neutral-400">
        {versaoStatus === "rascunho" ? `rascunho (a partir de v${Math.max(versaoNumero - 1, 0) || versaoNumero})` : `v${versaoNumero} publicada`}
      </span>
      <span className={`text-xs ${erroSalvar ? "text-red-600" : "text-neutral-400"}`}>{textoAutosave(salvando, erroSalvar, ultimoSalvoEm)}</span>
      <button
        type="button"
        disabled={!podePublicar || publicando}
        onClick={onPublicar}
        title={podePublicar ? undefined : "corrija os erros de validação antes de publicar"}
        className="rounded-lg bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {publicando ? "Publicando…" : "Publicar"}
      </button>
    </div>
  );
}
