import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { contarMensagensPorAgente, listarAgentes } from "@/lib/agentes";
import { listarEtiquetas } from "@/lib/etiquetas";
import { buscarModelo } from "@/lib/ia-provedores";
import { AgenteCardAcoes } from "@/components/AgenteCardAcoes";

export const dynamic = "force-dynamic";

/** Cria/edita agente = mexe em chave de API e texto que sai pro paciente sem revisão — só admin. */
export default async function AgentesPage() {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") {
    redirect("/");
  }

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">
          Não consegui conectar ao banco do CRM. Confira as variáveis de ambiente do Supabase.
        </p>
      </main>
    );
  }

  const [agentes, etiquetas, contagens] = await Promise.all([
    listarAgentes(clinicaId),
    listarEtiquetas(clinicaId),
    contarMensagensPorAgente(clinicaId),
  ]);
  const nomeEtiqueta = new Map(etiquetas.map((e) => [e.id, e.nome]));

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Agentes de IA</h1>
            <p className="text-sm text-neutral-500">Responda pacientes automaticamente pelo WhatsApp usando IA</p>
          </div>
          <Link href="/agentes/novo" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white">
            + Novo Agente
          </Link>
        </header>

        {agentes.length === 0 ? (
          <p className="rounded-xl border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-400">
            Nenhum agente criado ainda.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agentes.map((agente) => {
              const modelo = buscarModelo(agente.provider, agente.modelo);
              const etiqueta = agente.etiquetaGatilhoId ? nomeEtiqueta.get(agente.etiquetaGatilhoId) : null;

              return (
                <div key={agente.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <p className="font-medium text-neutral-900">{agente.nome}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                        agente.ativo
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : "bg-neutral-100 text-neutral-500 ring-neutral-500/20"
                      }`}
                    >
                      {agente.ativo ? "Ativo" : "Pausado"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {etiqueta && (
                      <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20">
                        🏷 {etiqueta}
                      </span>
                    )}
                    {modelo && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                        {modelo.label} {modelo.gratis ? "· Grátis" : "· Pago"}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-neutral-500">
                    <span className="font-semibold text-neutral-900">{contagens[agente.id] ?? 0}</span> mensagens enviadas
                  </p>

                  <AgenteCardAcoes id={agente.id} ativo={agente.ativo} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
