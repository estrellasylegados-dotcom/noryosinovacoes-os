import { NextResponse } from "next/server";
import { autorizarFluxos } from "@/lib/fluxo-http";
import { buscarFluxoParaEditor } from "@/lib/fluxo-versoes";
import { validarGrafo } from "@/lib/fluxo-validador";
import { validarReferenciasComerciais } from "@/lib/fluxo-comercial";
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await autorizarFluxos("automacoes.editar");
  if ("erro" in auth) return auth.erro;
  const { id } = await context.params;
  const fluxo = await buscarFluxoParaEditor(auth.clinicaId, id);
  if (!fluxo) return NextResponse.json({ ok: false }, { status: 404 });
  const grafo = validarGrafo(fluxo.definicao);
  const referencia = await validarReferenciasComerciais(auth.clinicaId, fluxo.definicao);
  return NextResponse.json({ ok: grafo.erros.length === 0 && !referencia, erros: grafo.erros, avisos: grafo.avisos, error: referencia });
}
