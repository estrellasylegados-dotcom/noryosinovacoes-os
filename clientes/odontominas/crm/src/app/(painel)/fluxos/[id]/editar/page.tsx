import { notFound, redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";

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
  if (!sessao?.permissoes.has("automacoes.editar")) redirect("/");

  const clinicaId = await getClinicaId();
  if (sessao.clinicaId !== clinicaId) redirect("/");
  if (!clinicaId) {
    return <main className="px-4 py-8 sm:px-8">Não consegui conectar ao banco agora.</main>;
  }

  const { id } = await params;
  const fluxo = await buscarFluxoParaEditor(clinicaId, id);
  if (!fluxo) notFound();

  const [execucoesTeste, execucoesReais, controleOdontoConfig, etiquetas, atendentes, agentes] = await Promise.all([
    sessao.permissoes.has("automacoes.visualizar_execucoes") ? listarExecucoesFluxo(clinicaId, id, { isTest: true, limit: 5 }) : Promise.resolve([]),
    sessao.permissoes.has("automacoes.visualizar_execucoes") ? listarExecucoesFluxo(clinicaId, id, { isTest: false, limit: 10 }) : Promise.resolve([]),
    Promise.resolve(getControleOdontoConfig()),
    listarEtiquetas(clinicaId),
    listarAtendentes(clinicaId),
    listarAgentes(clinicaId),
  ]);

  return (
    <FluxoEditor
      fluxo={fluxo}
      podePublicar={sessao.permissoes.has("automacoes.ativar")}
      podeVerExecucoes={sessao.permissoes.has("automacoes.visualizar_execucoes")}
      execucoesTesteIniciais={execucoesTeste}
      execucoesReaisIniciais={execucoesReais}
      controleOdontoConfigurado={controleOdontoConfig.enabled}
      etiquetas={etiquetas}
      atendentes={atendentes}
      agentes={agentes}
    />
  );
}
