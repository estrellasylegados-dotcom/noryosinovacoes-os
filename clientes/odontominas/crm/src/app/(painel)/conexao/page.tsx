import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { buscarQrCode, buscarStatusConexao } from "@/lib/evolution-status";
import { formatDataHora, formatTelefone } from "@/lib/tempo";

export const dynamic = "force-dynamic";

const LABEL_INTEGRACAO: Record<string, string> = {
  "WHATSAPP-BAILEYS": "Não-oficial (Baileys)",
  "WHATSAPP-BUSINESS": "API oficial (Meta)",
};

function iniciais(nome: string | null): string {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/);
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}

/** Reconectar o WhatsApp é sensível (troca o aparelho por trás do número da clínica) — só admin. */
export default async function ConexaoPage() {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") {
    redirect("/");
  }

  const status = await buscarStatusConexao();
  const qr = status.conectado ? null : await buscarQrCode();

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-md">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">Conexão do WhatsApp</h1>
          <p className="text-sm text-neutral-500">Instância ligada à Evolution API</p>
        </header>

        <div className="rounded-xl border border-neutral-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              {status.foto ? (
                // Foto de perfil vinda da Evolution API — não dá pra otimizar via next/image.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={status.foto} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white">
                  {iniciais(status.nome)}
                </div>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                  status.conectado ? "bg-emerald-500" : status.conectado === false ? "bg-red-500" : "bg-neutral-300"
                }`}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900">{status.nome || "WhatsApp"}</p>
              {status.numero && <p className="truncate text-xs text-neutral-500">{formatTelefone(status.numero)}</p>}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                status.conectado
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                  : status.conectado === false
                    ? "bg-red-50 text-red-700 ring-red-600/20"
                    : "bg-neutral-100 text-neutral-500 ring-neutral-500/20"
              }`}
            >
              {status.conectado ? "Conectado" : status.conectado === false ? "Desconectado" : "Sem status"}
            </span>
            {status.integracao && (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                {LABEL_INTEGRACAO[status.integracao] ?? status.integracao}
              </span>
            )}
          </div>

          {(status.criadaEm || status.numero) && (
            <dl className="mt-4 space-y-1.5 border-t border-neutral-100 pt-4 text-sm">
              {status.numero && (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Número</dt>
                  <dd className="font-medium text-neutral-900">{formatTelefone(status.numero)}</dd>
                </div>
              )}
              {status.criadaEm && (
                <div className="flex justify-between gap-2">
                  <dt className="text-neutral-500">Instância criada em</dt>
                  <dd className="font-medium text-neutral-900">{formatDataHora(status.criadaEm)}</dd>
                </div>
              )}
            </dl>
          )}

          {!status.conectado && qr?.qrDataUrl && (
            <div className="mt-5 flex flex-col items-center gap-3 border-t border-neutral-100 pt-5">
              <p className="text-center text-sm text-neutral-600">
                No celular usado pra atender: WhatsApp → Aparelhos conectados → Conectar aparelho, e
                escaneie o código abaixo.
              </p>
              {/* Data URI vindo da Evolution API — não dá pra otimizar via next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr.qrDataUrl}
                alt="QR Code de conexão do WhatsApp"
                className="h-56 w-56 rounded-lg border border-neutral-200"
              />
              <p className="text-xs text-neutral-400">A página atualiza sozinha — assim que conectar, o status muda aqui.</p>
            </div>
          )}

          {!status.conectado && !qr?.qrDataUrl && (
            <p className="mt-4 border-t border-neutral-100 pt-4 text-sm text-neutral-500">
              {qr?.erro === "nao_configurado" || status.erro === "nao_configurado"
                ? "Evolution API não configurada neste ambiente."
                : "Não consegui gerar o QR Code agora. A página atualiza sozinha em alguns segundos."}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
