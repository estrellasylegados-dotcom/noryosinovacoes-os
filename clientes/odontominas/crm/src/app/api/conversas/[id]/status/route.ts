import { NextResponse } from "next/server";
import { can, requireSessao } from "@/lib/autorizacao";
import { getSupabaseServerClient } from "@/lib/supabase";
import { registrarEventoConversa } from "@/lib/atribuicao";
import { getClinicaId } from "@/lib/clinica";
import { atualizarStatus } from "@/lib/conversas";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isStatusValido } from "@/lib/status";

/**
 * Fase 3 do CRM: troca manual de status no painel — a "ação leve" que o
 * plano técnico previu (visibilidade + ação leve, sem chat 2-way completo).
 */

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authSessao = await requireSessao();
  if ("erro" in authSessao) return authSessao.erro;
  const { id } = await context.params;

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.status || !isStatusValido(body.status)) {
    return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
  }

  const [clinicaId, sessao] = await Promise.all([getClinicaId(), getSessaoAtual()]);
  if (!clinicaId) {
    return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });
  }

  // Reabrir uma conversa FINALIZADA (status volta a novo/aguardando) exige conversas.reabrir.
  const reabre = body.status === "novo" || body.status === "aguardando";
  const supabase = getSupabaseServerClient();
  let estavaFinalizada = false;
  if (reabre && supabase) {
    const { data: atual } = await supabase.from("conversas").select("finalizada_em, status").eq("id", id).eq("clinica_id", clinicaId).maybeSingle();
    estavaFinalizada = Boolean(atual?.finalizada_em) || atual?.status === "agendado" || atual?.status === "perdido";
    if (estavaFinalizada && !can(authSessao.sessao, "conversas.reabrir")) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  const resultado = await atualizarStatus(clinicaId, id, body.status, sessao?.atendenteId ?? null);
  if (!resultado.ok) {
    const httpStatus = resultado.error === "not_found" ? 404 : 503;
    return NextResponse.json(resultado, { status: httpStatus });
  }

  if (reabre && supabase && estavaFinalizada) {
    await supabase.from("conversas").update({ finalizada_em: null }).eq("id", id).eq("clinica_id", clinicaId);
    await registrarEventoConversa(clinicaId, id, "CONVERSATION_REOPENED", sessao?.atendenteId ?? null);
  } else if (reabre && supabase) {
    await supabase.from("conversas").update({ finalizada_em: null }).eq("id", id).eq("clinica_id", clinicaId);
  }

  return NextResponse.json({ ok: true });
}
