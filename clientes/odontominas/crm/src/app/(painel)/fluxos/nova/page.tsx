import { redirect } from "next/navigation";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { TEMPLATES_ODONTO } from "@/lib/fluxo-templates";
import { FluxoNovoForm } from "@/components/fluxos/FluxoNovoForm";

export default async function NovoFluxoPage() {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) redirect("/");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
      <h1 className="text-xl font-semibold text-neutral-900">Novo fluxo</h1>
      <p className="mt-1 text-sm text-neutral-500">Comece do zero ou de um template — dá pra mudar tudo depois no editor.</p>
      <FluxoNovoForm templates={TEMPLATES_ODONTO.map((t) => ({ id: t.id, nome: t.nome, descricao: t.descricao }))} />
    </main>
  );
}
