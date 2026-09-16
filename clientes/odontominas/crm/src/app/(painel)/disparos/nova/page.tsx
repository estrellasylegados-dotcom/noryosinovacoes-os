import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { listarAudiencias } from "@/lib/audiencias";
import { listarMensagensSalvas } from "@/lib/mensagens-salvas";
import { listarEtiquetas } from "@/lib/etiquetas";
import { DisparosWizard } from "@/components/disparos/DisparosWizard";

export const dynamic = "force-dynamic";

export default async function NovaCampanhaPage() {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") redirect("/");

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return <main className="px-4 py-8 sm:px-8">Não consegui conectar ao banco agora.</main>;
  }

  const [audiencias, mensagensSalvas, etiquetas] = await Promise.all([
    listarAudiencias(clinicaId),
    listarMensagensSalvas(clinicaId),
    listarEtiquetas(clinicaId),
  ]);

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">Nova campanha</h1>
          <p className="text-sm text-neutral-500">Escolha o público, a mensagem e confirme — o envio roda sozinho depois</p>
        </header>

        <DisparosWizard audiencias={audiencias} mensagensSalvas={mensagensSalvas} etiquetas={etiquetas} />
      </div>
    </main>
  );
}
