import { NextResponse } from "next/server";
import { atorDaSessao, requirePermission, statusHttpErroConversa } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { assumirConversa } from "@/lib/atribuicao";

export const runtime = "nodejs";

/**
 * "Assumir": vira responsável de uma conversa SEM responsável. Atômico no banco
 * (UPDATE ... WHERE atribuido_a IS NULL): se outra pessoa chegou antes, 409
 * com o nome de quem assumiu — a UI mostra "acabou de ser assumida por X".
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("conversas.assumir");
  if ("erro" in auth) return auth.erro;

  const { id } = await context.params;
  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const resultado = await assumirConversa(clinicaId, id, atorDaSessao(auth.sessao));
  if (!resultado.ok) {
    const mensagemErro =
      resultado.error === "ja_assumida" ? `Esta conversa acabou de ser assumida por ${resultado.porNome ?? "outra pessoa"}.` : undefined;
    return NextResponse.json({ ...resultado, mensagemErro }, { status: statusHttpErroConversa(resultado.error) });
  }
  return NextResponse.json({ ok: true });
}
