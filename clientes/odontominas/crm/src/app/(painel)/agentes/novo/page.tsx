import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { buscarClinicaAtual, getClinicaId } from "@/lib/clinica";
import { listarEtiquetas } from "@/lib/etiquetas";
import { modelosDisponiveis } from "@/lib/ia-provedores";
import { AgenteForm } from "@/components/AgenteForm";

export const dynamic = "force-dynamic";

export default async function NovoAgentePage() {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) {
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

  const [etiquetas, clinicaAtual] = await Promise.all([listarEtiquetas(clinicaId), buscarClinicaAtual()]);

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">Novo Agente de IA</h1>
          <p className="text-sm text-neutral-500">Ele nasce pausado — você ativa quando estiver pronto.</p>
        </header>

        <AgenteForm etiquetasIniciais={etiquetas} modelos={modelosDisponiveis()} clinicaNome={clinicaAtual?.nome ?? "Clínica"} />
      </div>
    </main>
  );
}
