import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/autorizacao";
import { atualizarIncidenteOps, podeAcessarOps } from "@/lib/noryos-ops";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("ops.incidentes");
  if ("erro" in auth) return auth.erro;
  if (!podeAcessarOps(auth.sessao, "ops.incidentes")) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  const { id } = await ctx.params;
  const r = await atualizarIncidenteOps(id, body, auth.sessao);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
