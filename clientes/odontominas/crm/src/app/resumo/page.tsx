import Link from "next/link";
import { redirect } from "next/navigation";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { buscarResumoExecutivo } from "@/lib/resumo";
import { formatDuracao, formatTelefone } from "@/lib/tempo";
import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

/**
 * Visão de gestão (números do funil) — só admin. Atendente lida com conversa
 * por conversa no painel principal, não precisa do agregado do negócio.
 * Gate aqui, não só escondendo o link: sem isso, digitar a URL direto
 * contornava a diferença de papel.
 */
export default async function ResumoPage() {
  const [sessao, clinicaId] = await Promise.all([getSessaoAtual(), getClinicaId()]);

  if (sessao?.papel !== "admin") {
    redirect("/");
  }

  if (!clinicaId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-8">
        <p className="text-sm text-red-600">
          Não consegui conectar ao banco do CRM. Confira as variáveis de ambiente do Supabase.
        </p>
      </main>
    );
  }

  const resumo = await buscarResumoExecutivo(clinicaId);

  const cards: { label: string; valor: number; destaque?: boolean }[] = [
    { label: "Total de conversas", valor: resumo.total },
    { label: "Em aberto", valor: resumo.contagens.novo + resumo.contagens.aguardando },
    { label: "Esfriando", valor: resumo.leadsEsfriando.length, destaque: resumo.leadsEsfriando.length > 0 },
    { label: "Agendados", valor: resumo.contagens.agendado },
    { label: "Perdidos", valor: resumo.contagens.perdido },
  ];

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Resumo Executivo</h1>
            <p className="text-sm text-neutral-500">OdontoMinas — visão geral do funil de atendimento</p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Link href="/" className="text-sm font-medium text-teal-700 hover:underline">
              Painel
            </Link>
            {sessao && <span className="text-sm capitalize text-neutral-400">{sessao.papel}</span>}
            <LogoutButton />
          </div>
        </header>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((c) => (
            <div
              key={c.label}
              className={`rounded-xl border bg-white p-4 ${c.destaque ? "border-red-300" : "border-neutral-200"}`}
            >
              <p className="text-xs uppercase tracking-wide text-neutral-500">{c.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${c.destaque ? "text-red-600" : "text-neutral-900"}`}>
                {c.valor}
              </p>
            </div>
          ))}
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Tempo médio até 1ª resposta</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">
              {resumo.tempoMedioRespostaMs === null ? "—" : formatDuracao(resumo.tempoMedioRespostaMs)}
            </p>
          </div>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-medium text-neutral-700">Leads esfriando (esperando há mais de 30min)</h2>
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {resumo.leadsEsfriando.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-neutral-400">Nenhum lead esfriando agora.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {resumo.leadsEsfriando.map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-4 py-3">
                    {c.pacienteId ? (
                      <Link href={`/pacientes/${c.pacienteId}`} className="text-sm font-medium text-neutral-900 hover:underline">
                        {c.pacienteNome || formatTelefone(c.telefone)}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-neutral-900">
                        {c.pacienteNome || formatTelefone(c.telefone)}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-red-600">
                      esperando há {formatDuracao(c.tempoPrimeiraRespostaMs ?? 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
