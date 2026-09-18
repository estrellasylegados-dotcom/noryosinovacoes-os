import Link from "next/link";
import { notFound } from "next/navigation";
import { getClinicaId } from "@/lib/clinica";
import { buscarFichaPaciente } from "@/lib/pacientes";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { listarCampanhas } from "@/lib/campanhas";
import { LIMITE_ESPERA_MS, STATUS_CONFIG, labelStatus } from "@/lib/status";
import { formatDataHora, formatDuracao, formatTelefone } from "@/lib/tempo";
import { PacienteCampanhaOrigem } from "@/components/campanhas/PacienteCampanhaOrigem";
import { PacienteDataNascimento } from "@/components/pacientes/PacienteDataNascimento";
import { PacienteSolicitarAvaliacao } from "@/components/pacientes/PacienteSolicitarAvaliacao";

export const dynamic = "force-dynamic";

export default async function FichaPacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [clinicaId, sessao] = await Promise.all([getClinicaId(), getSessaoAtual()]);

  if (!clinicaId) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">
          Não consegui conectar ao banco do CRM. Confira as variáveis de ambiente do Supabase.
        </p>
      </main>
    );
  }

  const ficha = await buscarFichaPaciente(clinicaId, id);
  if (!ficha) notFound();

  const campanhas = isAdminEquivalente(sessao) ? await listarCampanhas(clinicaId) : [];

  const conversa = ficha.conversa;
  const emAberto = conversa?.status === "novo" || conversa?.status === "aguardando";
  const tempoEsperaMs =
    emAberto && conversa?.aguardandoDesde ? Date.now() - new Date(conversa.aguardandoDesde).getTime() : null;
  const atrasado = tempoEsperaMs !== null && tempoEsperaMs > LIMITE_ESPERA_MS;

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-medium text-teal-700 hover:underline">
          ← Painel
        </Link>

        <header className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">{ficha.nome || "Sem nome"}</h1>
            <p className="text-sm text-neutral-500">
              {formatTelefone(ficha.telefone)}
              {ficha.email ? ` · ${ficha.email}` : ""}
            </p>
          </div>
          {conversa && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_CONFIG[conversa.status].corBadge}`}
            >
              {STATUS_CONFIG[conversa.status].label}
              {tempoEsperaMs !== null && (
                <span className={atrasado ? "ml-1 font-semibold" : "ml-1"}>
                  · esperando há {formatDuracao(tempoEsperaMs)}
                </span>
              )}
            </span>
          )}
        </header>

        <div className="mb-6 space-y-2">
          <PacienteDataNascimento pacienteId={ficha.id} dataNascimentoAtual={ficha.dataNascimento} />
          <PacienteSolicitarAvaliacao pacienteId={ficha.id} />
          {isAdminEquivalente(sessao) && (
            <PacienteCampanhaOrigem
              pacienteId={ficha.id}
              campanhaAtualId={ficha.campanhaId}
              campanhas={campanhas.map((c) => ({ id: c.id, nome: c.nome }))}
            />
          )}
        </div>

        {ficha.eventos.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Jornada</h2>
            <ol className="space-y-1.5 text-sm text-neutral-600">
              {ficha.eventos.map((e, i) => (
                <li key={i}>
                  <span className="text-neutral-400">{formatDataHora(e.quando)}</span>{" "}
                  {e.statusAnterior ? `${labelStatus(e.statusAnterior)} → ` : ""}
                  {labelStatus(e.statusNovo)}
                  {e.atendenteNome && <span className="text-neutral-400"> · {e.atendenteNome}</span>}
                </li>
              ))}
            </ol>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Conversa</h2>
          <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
            {ficha.mensagens.length === 0 && (
              <p className="text-sm text-neutral-400">Nenhuma mensagem ainda.</p>
            )}
            {ficha.mensagens.map((m) => (
              <div key={m.id} className={`flex ${m.direcao === "enviada" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    m.direcao === "enviada" ? "bg-teal-700 text-white" : "bg-neutral-100 text-neutral-800"
                  }`}
                >
                  <p>{m.conteudo ?? `[${m.tipo}]`}</p>
                  <p className={`mt-1 text-[10px] ${m.direcao === "enviada" ? "text-teal-100" : "text-neutral-400"}`}>
                    {formatDataHora(m.quando)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
