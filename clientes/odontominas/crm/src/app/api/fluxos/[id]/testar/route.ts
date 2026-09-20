import { NextResponse } from "next/server";
import { autorizarFluxos } from "@/lib/fluxo-http";
import { buscarFluxoParaEditor } from "@/lib/fluxo-versoes";
import { validarGrafo } from "@/lib/fluxo-validador";
import { iniciarExecucaoFluxo } from "@/lib/fluxo-execucoes";

export const runtime = "nodejs";

/**
 * Testa o RASCUNHO atual (não precisa estar publicado) contra um contato
 * escolhido pelo admin (`/api/fluxos/contatos-teste`, nunca um número
 * hardcoded). Reusa `iniciarExecucaoFluxo` direto — `isTest=true` +
 * `versaoIdForcada` são os dois ajustes que tornam isso possível sem
 * duplicar a lógica da engine (ver fluxo-execucoes.ts).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await autorizarFluxos("automacoes.editar");
  if ("erro" in auth) return auth.erro;
  const { clinicaId } = auth;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { pacienteId?: string; conversaId?: string } | null;
  if (!body || typeof body.pacienteId !== "string" || typeof body.conversaId !== "string") {
    return NextResponse.json({ ok: false, error: "campos_obrigatorios" }, { status: 400 });
  }

  const fluxo = await buscarFluxoParaEditor(clinicaId, id);
  if (!fluxo) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const grafo = validarGrafo(fluxo.definicao);
  if (grafo.erros.length > 0) {
    return NextResponse.json({ ok: false, error: "grafo_invalido", erros: grafo.erros }, { status: 400 });
  }

  const resultado = await iniciarExecucaoFluxo(
    clinicaId,
    id,
    body.conversaId,
    body.pacienteId,
    { tipo: "manual", refId: null, dedupeKey: null },
    fluxo.podeInterromperAgenteIa,
    true,
    false,
    fluxo.versaoId
  );

  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
