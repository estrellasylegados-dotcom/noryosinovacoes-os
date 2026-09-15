import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { buscarQrCode, buscarStatusConexao } from "@/lib/evolution-status";
import { formatTelefone } from "@/lib/tempo";

export const dynamic = "force-dynamic";

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
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                status.conectado ? "bg-emerald-500" : status.conectado === false ? "bg-red-500" : "bg-neutral-300"
              }`}
            />
            <span className="text-sm font-medium text-neutral-900">
              {status.conectado
                ? "Conectado"
                : status.conectado === false
                  ? "Desconectado"
                  : "Não foi possível verificar agora"}
            </span>
          </div>
          {status.numero && <p className="mt-1 pl-[18px] text-sm text-neutral-500">{formatTelefone(status.numero)}</p>}

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
            <p className="mt-4 text-sm text-neutral-500">
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
