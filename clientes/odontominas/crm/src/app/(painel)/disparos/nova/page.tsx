import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { listarAudiencias } from "@/lib/audiencias";
import { listarMensagensSalvas } from "@/lib/mensagens-salvas";
import { listarEtiquetas } from "@/lib/etiquetas";
import { buscarCampanha } from "@/lib/campanhas";
import { DisparosWizard } from "@/components/disparos/DisparosWizard";

export const dynamic = "force-dynamic";

export default async function NovoDisparoPage({
  searchParams,
}: {
  searchParams: Promise<{ campanhaId?: string }>;
}) {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) redirect("/");

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return <main className="px-4 py-8 sm:px-8">Não consegui conectar ao banco agora.</main>;
  }

  const { campanhaId } = await searchParams;

  const [audiencias, mensagensSalvas, etiquetas, campanha] = await Promise.all([
    listarAudiencias(clinicaId),
    listarMensagensSalvas(clinicaId),
    listarEtiquetas(clinicaId),
    campanhaId ? buscarCampanha(clinicaId, campanhaId) : Promise.resolve(null),
  ]);

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">Novo disparo</h1>
          <p className="text-sm text-neutral-500">Escolha o público, a mensagem e confirme — o envio roda sozinho depois</p>
          {campanha && (
            <p className="mt-2 text-xs font-medium text-teal-700">Vinculado à campanha &quot;{campanha.nome}&quot;</p>
          )}
        </header>

        <DisparosWizard
          audiencias={audiencias}
          mensagensSalvas={mensagensSalvas}
          etiquetas={etiquetas}
          campanhaId={campanha?.id ?? null}
          audienciaPadraoId={campanha?.audienciaId ?? null}
        />
      </div>
    </main>
  );
}
