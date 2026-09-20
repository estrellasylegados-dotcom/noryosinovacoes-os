import { NextResponse } from "next/server";
import { autorizarFluxos } from "@/lib/fluxo-http";
import { atualizarStatusFluxo, isStatusFluxoValido } from "@/lib/fluxo-versoes";
import { registrarEvento } from "@/lib/auditoria";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await autorizarFluxos("automacoes.visualizar");
  if ("erro" in auth) return auth.erro;
  const { clinicaId, sessao } = auth;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { status?: string; interromperExecucoes?: boolean } | null;
  if (!body || !body.status || !isStatusFluxoValido(body.status)) {
    return NextResponse.json({ ok: false, error: "status_invalido" }, { status: 400 });
  }

  const permissao = body.status === "ativo" ? "automacoes.ativar" : body.status === "pausado" ? "automacoes.pausar" : "automacoes.excluir";
  if (!sessao.permissoes.has(permissao) || (body.interromperExecucoes && !sessao.permissoes.has("automacoes.pausar"))) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const resultado = await atualizarStatusFluxo(clinicaId, id, body.status, sessao.atendenteId, body.interromperExecucoes === true);
  if (resultado.ok) await registrarEvento({ clinicaId, atorId: sessao.atendenteId, evento: "AUTOMATION_STATUS_CHANGED", alvoId: id, detalhes: { status: body.status, interromperExecucoes: body.interromperExecucoes === true } });
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
