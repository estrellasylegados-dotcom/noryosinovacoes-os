import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { criarMensagemSalva } from "@/lib/mensagens-salvas";

export const runtime = "nodejs";

/** "Salvar esta mensagem pra reusar depois", no passo 2 do wizard de Disparos. */
export async function POST(request: Request) {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { nome?: string; conteudo?: string } | null;
  if (!body || typeof body.nome !== "string" || typeof body.conteudo !== "string") {
    return NextResponse.json({ ok: false, error: "campos_obrigatorios" }, { status: 400 });
  }

  const resultado = await criarMensagemSalva(clinicaId, body.nome, body.conteudo, sessao.atendenteId);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
