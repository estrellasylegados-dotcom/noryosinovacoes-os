import { notFound, redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { buscarFluxoParaEditor } from "@/lib/fluxo-versoes";
import { listarExecucoesFluxo } from "@/lib/fluxo-execucoes-consulta";
import { getControleOdontoConfig } from "@/lib/controle-odonto/config";
import { listarEtiquetas } from "@/lib/etiquetas";
import { listarAtendentes } from "@/lib/atendentes";
import { listarAgentes } from "@/lib/agentes";
import { FluxoEditor } from "@/components/fluxos/FluxoEditor";

export const dynamic = "force-dynamic";

export default async function EditarFluxoPage({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) redirect("/");

  const clinicaId = await getClinicaId();
  if (!clinicaId) {
    return <main className="px-4 py-8 sm:px-8">Não consegui conectar ao banco agora.</main>;
  }

  const { id } = await params;
  const fluxo = await buscarFluxoParaEditor(clinicaId, id);
  if (!fluxo) notFound();

  const [execucoesTeste, controleOdontoConfig, etiquetas, atendentes, agentes] = await Promise.all([
    listarExecucoesFluxo(clinicaId, id, { isTest: true, limit: 5 }),
    Promise.resolve(getControleOdontoConfig()),
    listarEtiquetas(clinicaId),
    listarAtendentes(clinicaId),
    listarAgentes(clinicaId),
  ]);

  return (
    <FluxoEditor
      fluxo={fluxo}
      execucoesTesteIniciais={execucoesTeste}
      controleOdontoConfigurado={controleOdontoConfig.enabled}
      etiquetas={etiquetas}
      atendentes={atendentes}
      agentes={agentes}
    />
  );
}
