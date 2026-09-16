import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { buscarAgente, buscarEstatisticasAgente } from "@/lib/agentes";
import { listarEtiquetas } from "@/lib/etiquetas";
import { buscarModelo, modelosDisponiveis } from "@/lib/ia-provedores";
import { formatTempoResposta } from "@/lib/tempo";
import { AgenteForm } from "@/components/AgenteForm";
import { AgenteStatusHeader } from "@/components/AgenteStatusHeader";

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

  const [etiquetas, estatisticas] = await Promise.all([
    listarEtiquetas(clinicaId),
    buscarEstatisticasAgente(clinicaId, agente.id),
  ]);
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
        <AgenteStatusHeader id={agente.id} nome={agente.nome} ativo={agente.ativo} />

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CardEstatistica label="Mensagens" valor={String(estatisticas.mensagens)} />
          <CardEstatistica label="Conversas" valor={String(estatisticas.conversas)} />
          <CardEstatistica
            label="Tempo Médio"
            valor={estatisticas.tempoMedioRespostaMs !== null ? formatTempoResposta(estatisticas.tempoMedioRespostaMs) : "—"}
          />
          <CardEstatistica label="Conhecimentos" valor={String(estatisticas.conhecimentos)} />
        </div>

        <AgenteForm agente={agente} etiquetasIniciais={etiquetas} modelos={opcoes} />
      </div>
    </main>
  );
}

function CardEstatistica({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-neutral-900">{valor}</p>
    </div>
  );
}
