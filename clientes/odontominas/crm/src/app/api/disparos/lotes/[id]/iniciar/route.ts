import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { iniciarDisparo } from "@/lib/disparos";

export const runtime = "nodejs";

/** "Criar e iniciar agora" de um rascunho salvo — o worker (src/lib/disparos-worker.ts) pega daqui em diante. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const { id } = await context.params;
  const resultado = await iniciarDisparo(clinicaId, id);
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}
