import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { listarAudiencias } from "@/lib/audiencias";
import { listarEtiquetas } from "@/lib/etiquetas";
import { listarAtendentes } from "@/lib/atendentes";
import { listarAgentes } from "@/lib/agentes";
import { CampanhaForm } from "@/components/campanhas/CampanhaForm";

export const dynamic = "force-dynamic";

export default async function NovaCampanhaPage() {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) redirect("/");

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return <main className="px-4 py-8 sm:px-8">Não consegui conectar ao banco agora.</main>;
  }

  const [audiencias, etiquetas, atendentes, agentes] = await Promise.all([
    listarAudiencias(clinicaId),
    listarEtiquetas(clinicaId),
    listarAtendentes(clinicaId),
    listarAgentes(clinicaId),
  ]);

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">Nova campanha</h1>
          <p className="text-sm text-neutral-500">Objetivo, público, canais e metas — o disparo de WhatsApp vem depois, vinculado a ela.</p>
        </header>

        <CampanhaForm
          modo="criacao"
          audiencias={audiencias}
          etiquetas={etiquetas}
          atendentes={atendentes.map((a) => ({ id: a.id, nome: a.nome }))}
          agentes={agentes.map((a) => ({ id: a.id, nome: a.nome }))}
        />
      </div>
    </main>
  );
}
