import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/autorizacao";
import { getClinicaId } from "@/lib/clinica";
import type { Permissao } from "@/lib/permissoes";
export async function autorizarFluxos(permissao: Permissao) {
  const auth = await requirePermission(permissao);
  if ("erro" in auth) return auth;
  const clinicaId = await getClinicaId();
  if (!clinicaId) return { erro: NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 }) };
  if (auth.sessao.clinicaId !== clinicaId) return { erro: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  return { clinicaId, sessao: auth.sessao };
}
