import { tratarAcaoAlerta } from "@/lib/alertas-http";

export const runtime = "nodejs";

/** POST /api/alertas/:id/resolver — ação explícita (não existe PATCH genérico de status). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return tratarAcaoAlerta(request, context, "resolver");
}
