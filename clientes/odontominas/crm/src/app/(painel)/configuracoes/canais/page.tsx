import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { can } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { listarCanais, paraPublico, verificarSaudeCanal } from "@/lib/canais";
import { CanaisPanel, type CanalView } from "@/components/canais/CanaisPanel";

export const dynamic = "force-dynamic";

/** Configurações → Canais: cada número de WhatsApp da clínica, com status ao vivo e as ações que o perfil permite. */
export default async function CanaisPage({ searchParams }: { searchParams: Promise<{ canal?: string }> }) {
  const [sessao, { canal: canalDestaque }] = await Promise.all([getSessaoAtual(), searchParams]);
  if (!sessao || !(can(sessao, "canais.visualizar") || can(sessao, "suporte.acesso_tecnico"))) redirect("/");

  const clinicaId = await getClinicaId();
  const canais = clinicaId ? await listarCanais(clinicaId) : [];
  // Status AO VIVO (o salvo é só cache): consulta o provider de todos em paralelo, timeout curto por canal.
  const saudes = await Promise.all(canais.map((c) => verificarSaudeCanal(c)));

  const verTecnico = can(sessao, "canais.configurar") || can(sessao, "suporte.acesso_tecnico");
  const canaisView: CanalView[] = canais.map((c, i) => ({
    ...paraPublico(c),
    status: saudes[i].status,
    telefone: saudes[i].telefone,
    instancia: verTecnico ? c.providerInstanceId : null,
  }));

  return (
    <main className="px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900">Canais de atendimento</h1>
          <p className="text-sm text-neutral-500">
            Cada canal é um número da clínica. Várias atendentes trabalham no mesmo canal pelo Noryos — o número pertence à clínica, não a uma pessoa.
          </p>
        </header>

        <CanaisPanel
          canais={canaisView}
          podeConfigurar={can(sessao, "canais.configurar")}
          podeConectar={can(sessao, "canais.conectar")}
          podeDesconectar={can(sessao, "canais.desconectar")}
          destaqueId={canalDestaque && canaisView.some((c) => c.id === canalDestaque) ? canalDestaque : null}
        />
      </div>
    </main>
  );
}
