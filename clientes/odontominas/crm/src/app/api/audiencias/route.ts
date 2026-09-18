import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import { salvarAudiencia, type FiltroAudiencia } from "@/lib/audiencias";

export const runtime = "nodejs";

/**
 * Salvar audiência como reutilizável — usada tanto por Disparos quanto por
 * Campanhas (item "Idealmente criar/reutilizar um motor central de
 * público" do briefing de Campanhas). Sem rota própria até agora porque o
 * wizard de Disparos nunca expôs "salvar audiência" na UI; `salvarAudiencia`
 * já existia em src/lib/audiencias.ts (Fase A de Disparos), só sem chamador.
 */
export async function POST(request: Request) {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { nome?: string; descricao?: string | null; filtro?: FiltroAudiencia } | null;
  if (!body || typeof body.nome !== "string" || !body.filtro) {
    return NextResponse.json({ ok: false, error: "campos_obrigatorios" }, { status: 400 });
  }

  const resultado = await salvarAudiencia(clinicaId, body.nome, body.descricao ?? null, body.filtro, sessao.atendenteId);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
