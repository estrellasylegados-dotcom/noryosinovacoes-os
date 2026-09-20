import { NextResponse } from "next/server";
import { autorizarFluxos } from "@/lib/fluxo-http";
import { publicarFluxo } from "@/lib/fluxo-versoes";
import { registrarEvento } from "@/lib/auditoria";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await autorizarFluxos("automacoes.editar");
  if ("erro" in auth) return auth.erro;
  const { clinicaId, sessao } = auth;
  if (!sessao.permissoes.has("automacoes.ativar")) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await context.params;
  const resultado = await publicarFluxo(clinicaId, id, sessao.atendenteId);
  if (resultado.ok) await registrarEvento({ clinicaId, atorId: sessao.atendenteId, evento: "AUTOMATION_PUBLISHED", alvoId: id, detalhes: { versaoId: resultado.versaoId } });
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
