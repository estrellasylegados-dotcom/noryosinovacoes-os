import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { isAdminEquivalente } from "@/lib/autorizacao";
import { resolverVariaveis } from "@/lib/mensagens-salvas";

export const runtime = "nodejs";

/**
 * Passo 2 do wizard de Disparos: resolve `{nome}`/`{primeiro_nome}`/`{telefone}`
 * pra um destinatário de exemplo. Fica numa rota (em vez de importar
 * `resolverVariaveis` direto no client component) porque `mensagens-salvas.ts`
 * também exporta função que usa o client Supabase server-side — nunca deve
 * entrar no bundle do navegador.
 */
export async function POST(request: Request) {
  const sessao = await getSessaoAtual();
  if (!isAdminEquivalente(sessao)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as
    | { texto?: string; nome?: string | null; telefone?: string | null }
    | null;
  if (!body || typeof body.texto !== "string") {
    return NextResponse.json({ ok: false, error: "campos_obrigatorios" }, { status: 400 });
  }

  const preview = resolverVariaveis(body.texto, { nome: body.nome ?? null, telefone: body.telefone ?? null });
  return NextResponse.json({ ok: true, preview });
}
