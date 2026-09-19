import Link from "next/link";
import { redirect } from "next/navigation";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { can } from "@/lib/autorizacao";
import { clinicaDaSessao } from "@/lib/alertas-http";
import { buscarConfigAlertas } from "@/lib/alertas-config";
import { TIPOS_ALERTA, TODOS_OS_TIPOS } from "@/lib/alertas-tipos";
import { AlertasConfigForm, type TipoConfig } from "@/components/alertas/AlertasConfigForm";

export const dynamic = "force-dynamic";

/** Configurações → Alertas: quais tipos ligar, os tempos e o tempo máximo por etapa do Kanban. Exige `alertas.configurar` (o PUT confere de novo). */
export default async function ConfigAlertasPage() {
  const [sessao, clinicaBase] = await Promise.all([getSessaoAtual(), getClinicaId()]);
  if (!sessao || !can(sessao, "alertas.configurar")) redirect("/");

  const clinicaId = clinicaDaSessao(sessao, clinicaBase);
  if (!clinicaId) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">Não consegui abrir a configuração de alertas desta clínica.</p>
      </main>
    );
  }

  const config = await buscarConfigAlertas(clinicaId);
  const tipos: TipoConfig[] = TODOS_OS_TIPOS.filter((t) => TIPOS_ALERTA[t].natureza === "operacional" || can(sessao, "alertas.tecnicos")).map((t) => ({
    id: t,
    rotulo: TIPOS_ALERTA[t].rotulo,
    descricao: TIPOS_ALERTA[t].descricaoConfig,
    tecnico: TIPOS_ALERTA[t].natureza === "tecnico",
  }));

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <Link href="/alertas" className="text-sm font-medium text-teal-700">
            ← Alertas
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-neutral-900">Configurar alertas</h1>
          <p className="text-sm text-neutral-500">Alerta só existe quando exige ação de alguém. Aqui você escolhe o que a equipe precisa ver e em quanto tempo.</p>
        </header>
        <AlertasConfigForm config={config} tipos={tipos} />
      </div>
    </main>
  );
}
