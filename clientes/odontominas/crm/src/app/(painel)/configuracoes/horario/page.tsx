import { redirect } from "next/navigation";
import { getClinicaId } from "@/lib/clinica";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { buscarConfiguracaoHorario } from "@/lib/horario-atendimento";
import { HorarioAtendimentoForm } from "@/components/HorarioAtendimentoForm";

export const dynamic = "force-dynamic";

/** Fundação pro SLA futuro — mexe em config que vai virar regra de negócio, mesmo gate de Reputação/Agentes/Equipe: só admin. */
export default async function HorarioAtendimentoPage() {
  const [sessao, clinicaId] = await Promise.all([getSessaoAtual(), getClinicaId()]);

  if (sessao?.papel !== "admin") redirect("/");

  if (!clinicaId) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">Não consegui conectar ao banco do CRM. Confira as variáveis de ambiente do Supabase.</p>
      </main>
    );
  }

  const config = await buscarConfiguracaoHorario(clinicaId);
  if (!config) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-red-600">Não consegui carregar a configuração de horário desta clínica.</p>
      </main>
    );
  }

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold text-neutral-900">Horário de Atendimento</h1>
          <p className="text-sm text-neutral-500">
            Base pra SLA, filas e automações futuras — ainda não conectada em nada disso, é só a configuração.
          </p>
        </header>

        <HorarioAtendimentoForm configInicial={config} />
      </div>
    </main>
  );
}
