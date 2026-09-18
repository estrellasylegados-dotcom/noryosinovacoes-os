import { NextResponse } from "next/server";
import { buscarAtendentePorId } from "@/lib/atendentes";
import { criarConvite } from "@/lib/convites";
import { enviarEmailConvite } from "@/lib/email";
import { getClinicaId } from "@/lib/clinica";
import { requirePermission } from "@/lib/autorizacao";
import { estaBloqueado, registrarFalha } from "@/lib/rate-limit-login";

export const runtime = "nodejs";

/** Reenviar convite (seção 38 do pedido) — gera um token novo; o antigo (se ainda pendente) é invalidado quando este for aceito (ver src/lib/convites.ts). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("usuarios.criar");
  if ("erro" in auth) return auth.erro;
  const { sessao } = auth;

  const chave = `reenviar-convite:${sessao.atendenteId}`;
  const bloqueio = estaBloqueado(chave);
  if (bloqueio.bloqueado) {
    return NextResponse.json({ ok: false, error: "muitas_tentativas" }, { status: 429 });
  }
  registrarFalha(chave);

  const { id } = await context.params;
  const clinicaId = sessao.clinicaId ?? (await getClinicaId());
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const atendente = await buscarAtendentePorId(clinicaId, id);
  if (!atendente) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (atendente.status !== "invited") return NextResponse.json({ ok: false, error: "conta_ja_ativa" }, { status: 400 });
  if (!atendente.email) return NextResponse.json({ ok: false, error: "sem_email" }, { status: 400 });

  const tokenBruto = await criarConvite(atendente.id, sessao.atendenteId);
  if (!tokenBruto) return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });

  const envio = await enviarEmailConvite(atendente.email, atendente.nome, tokenBruto);
  return NextResponse.json({ ok: true, emailEnviado: envio.ok });
}
