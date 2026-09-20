import { redirect } from "next/navigation";
import { can } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { clinicaDaSessao } from "@/lib/alertas-http";
import { buscarConfigDistribuicao } from "@/lib/distribuicao-automatica";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { DistribuicaoAutomaticaForm } from "@/components/DistribuicaoAutomaticaForm";

export const dynamic = "force-dynamic";

export default async function DistribuicaoAutomaticaPage() {
  const [sessao, clinicaBase] = await Promise.all([getSessaoAtual(), getClinicaId()]);
  if (!sessao || !can(sessao, "configuracoes.clinica")) redirect("/");

  const clinicaId = clinicaDaSessao(sessao, clinicaBase);
  if (!clinicaId) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">Nao consegui abrir a configuracao desta clinica.</p>
      </main>
    );
  }

  const config = await buscarConfigDistribuicao(clinicaId);

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-neutral-900">Distribuicao automatica</h1>
          <p className="text-sm text-neutral-500">Atendimento</p>
        </header>
        <DistribuicaoAutomaticaForm configInicial={config} />
      </div>
    </main>
  );
}
