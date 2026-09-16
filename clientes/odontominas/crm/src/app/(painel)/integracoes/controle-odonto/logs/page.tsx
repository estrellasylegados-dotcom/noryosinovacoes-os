import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { listarLogs } from "@/lib/controle-odonto/sync-log";
import { formatDataHora } from "@/lib/tempo";

export const dynamic = "force-dynamic";

const LABEL_STATUS: Record<string, string> = { sucesso: "Sucesso", erro: "Erro", ignorado: "Ignorado" };

export default async function ControleOdontoLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; direction?: string; resource?: string }>;
}) {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") {
    redirect("/");
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return <main className="px-4 py-8 sm:px-8">Não consegui conectar ao banco agora.</main>;
  }

  const filtros = await searchParams;
  const logs = await listarLogs(clinicaId, {
    status: filtros.status === "sucesso" || filtros.status === "erro" ? filtros.status : undefined,
    direction: filtros.direction === "entrada" || filtros.direction === "saida" ? filtros.direction : undefined,
    resource: filtros.resource || undefined,
  });

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">Logs — ControleODONTO</h1>
          <p className="text-sm text-neutral-500">Últimas {logs.length} tentativa(s) de sincronização</p>
        </header>

        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {(["sucesso", "erro"] as const).map((s) => (
            <a
              key={s}
              href={`?status=${s}`}
              className={`rounded-full px-2.5 py-1 font-medium ring-1 ring-inset ${
                filtros.status === s ? "bg-teal-700 text-white ring-teal-700" : "text-neutral-600 ring-neutral-300 hover:bg-neutral-100"
              }`}
            >
              {LABEL_STATUS[s]}
            </a>
          ))}
          <a
            href="/integracoes/controle-odonto/logs"
            className="rounded-full px-2.5 py-1 font-medium text-neutral-600 ring-1 ring-inset ring-neutral-300 hover:bg-neutral-100"
          >
            Todos
          </a>
        </div>

        {logs.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">
            Nenhum registro ainda — a sincronização ainda não rodou (aguardando credencial confirmada).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-100 text-xs text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Hora</th>
                  <th className="px-4 py-2">Operação</th>
                  <th className="px-4 py-2">Recurso</th>
                  <th className="px-4 py-2">Resultado</th>
                  <th className="px-4 py-2">Latência</th>
                  <th className="px-4 py-2">Tentativa</th>
                  <th className="px-4 py-2">Erro</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id as string} className="border-b border-neutral-50 last:border-0">
                    <td className="px-4 py-2 text-neutral-500">{formatDataHora(log.started_at as string)}</td>
                    <td className="px-4 py-2">{log.operation as string}</td>
                    <td className="px-4 py-2">{log.resource as string}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          log.status === "sucesso"
                            ? "bg-emerald-50 text-emerald-700"
                            : log.status === "erro"
                              ? "bg-red-50 text-red-700"
                              : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {LABEL_STATUS[log.status as string] ?? (log.status as string)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{log.duration_ms ? `${log.duration_ms}ms` : "—"}</td>
                    <td className="px-4 py-2 text-neutral-500">{log.attempt as number}</td>
                    <td className="px-4 py-2 text-neutral-500">
                      {log.error_code ? (
                        <details>
                          <summary className="cursor-pointer text-red-600">Ver detalhes técnicos</summary>
                          <span className="text-xs">
                            {log.error_code as string}
                            {log.error_message_sanitized ? ` — ${log.error_message_sanitized as string}` : ""}
                          </span>
                        </details>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
