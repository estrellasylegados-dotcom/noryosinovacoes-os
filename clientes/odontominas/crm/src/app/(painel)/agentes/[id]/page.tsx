import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { buscarAgente } from "@/lib/agentes";
import { listarEtiquetas } from "@/lib/etiquetas";
import { buscarModelo, modelosDisponiveis } from "@/lib/ia-provedores";
import { AgenteForm } from "@/components/AgenteForm";

export const dynamic = "force-dynamic";

export default async function EditarAgentePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  const agente = await buscarAgente(clinicaId, id);
  if (!agente) {
    redirect("/agentes");
  }

  const etiquetas = await listarEtiquetas(clinicaId);
  const modelos = modelosDisponiveis();
  // Garante que o modelo já configurado no agente apareça no seletor mesmo que
  // a chave dele tenha sido removida do ambiente depois — nunca deixa o form
  // com um valor selecionado que não existe nas opções.
  const modeloAtual = buscarModelo(agente.provider, agente.modelo);
  const opcoes = modeloAtual && !modelos.some((m) => m.provider === modeloAtual.provider && m.id === modeloAtual.id)
    ? [...modelos, modeloAtual]
    : modelos;

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">Editar Agente</h1>
          <p className="text-sm text-neutral-500">{agente.nome}</p>
        </header>

        <AgenteForm agente={agente} etiquetasIniciais={etiquetas} modelos={opcoes} />
      </div>
    </main>
  );
}
