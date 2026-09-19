import { NextResponse } from "next/server";
import { listarAlertas, type FiltrosAlertas } from "@/lib/alertas-consulta";
import { autorizarAlertas } from "@/lib/alertas-http";
import { isSeveridade } from "@/lib/alertas-tipos";

export const runtime = "nodejs";

/** GET /api/alertas?situacao=ativos|resolvidos&severidade=&categoria=&responsavel=(id|sem)&de=&ate=&busca=&pagina= */
export async function GET(request: Request) {
  const a = await autorizarAlertas("alertas.visualizar");
  if ("erro" in a) return a.erro;

  const q = new URL(request.url).searchParams;
  const severidade = q.get("severidade");
  const filtros: FiltrosAlertas = {
    situacao: q.get("situacao") === "resolvidos" ? "resolvidos" : "ativos",
    severidade: severidade && isSeveridade(severidade) ? severidade : undefined,
    categoria: q.get("categoria") || undefined,
    responsavel: q.get("responsavel") || undefined,
    de: q.get("de") || undefined,
    ate: q.get("ate") || undefined,
    busca: q.get("busca") || undefined,
    pagina: Number(q.get("pagina")) || 1,
  };
  return NextResponse.json({ ok: true, ...(await listarAlertas(a.clinicaId, a.ator, filtros)) });
}
