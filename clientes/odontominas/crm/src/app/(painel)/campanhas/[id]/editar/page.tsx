import { notFound, redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { buscarCampanha } from "@/lib/campanhas";
import { listarAudiencias } from "@/lib/audiencias";
import { listarEtiquetas } from "@/lib/etiquetas";
import { listarAtendentes } from "@/lib/atendentes";
import { listarAgentes } from "@/lib/agentes";
import { CampanhaForm } from "@/components/campanhas/CampanhaForm";

export const dynamic = "force-dynamic";

export default async function EditarCampanhaPage({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") redirect("/");

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return <main className="px-4 py-8 sm:px-8">Não consegui conectar ao banco agora.</main>;
  }

  const { id } = await params;
  const [campanha, audiencias, etiquetas, atendentes, agentes] = await Promise.all([
    buscarCampanha(clinicaId, id),
    listarAudiencias(clinicaId),
    listarEtiquetas(clinicaId),
    listarAtendentes(clinicaId),
    listarAgentes(clinicaId),
  ]);
  if (!campanha) notFound();

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">Editar campanha</h1>
          <p className="text-sm text-neutral-500">{campanha.nome}</p>
        </header>

        <CampanhaForm
          modo="edicao"
          campanha={campanha}
          audiencias={audiencias}
          etiquetas={etiquetas}
          atendentes={atendentes.map((a) => ({ id: a.id, nome: a.nome }))}
          agentes={agentes.map((a) => ({ id: a.id, nome: a.nome }))}
        />
      </div>
    </main>
  );
}
