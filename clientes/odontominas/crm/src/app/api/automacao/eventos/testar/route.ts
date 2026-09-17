import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { emitirEventoAutomacao } from "@/lib/fluxo-eventos-internos";

export const runtime = "nodejs";

/**
 * Fase 3 (evolução arquitetural — ver _memoria/decisoes.md): rota de
 * validação CONTROLADA do mecanismo de eventos internos
 * (emitirEventoAutomacao) — não uma forma de simular qualquer automação em
 * produção à vontade. Dupla barreira: admin (sessão) E
 * (`NODE_ENV !== "production"` OU `AUTOMACAO_EVENTOS_TESTE_HABILITADO=true`
 * setado explicitamente). `atendimento_concluido` não tem origem real hoje
 * (ver fluxo-eventos-internos.ts) — esta rota é o único jeito de testar essa
 * categoria de gatilho antes de existir uma origem confiável.
 *
 * PENDÊNCIA (ver relatório de entrega da Fase 3): decidir com o Rafael se
 * esta rota deve ser removida, ou permanecer atrás da flag, quando a Fase 3
 * for validada em produção.
 */
export async function POST(request: Request) {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const habilitado = process.env.NODE_ENV !== "production" || process.env.AUTOMACAO_EVENTOS_TESTE_HABILITADO === "true";
  if (!habilitado) return NextResponse.json({ ok: false, error: "rota_desabilitada_em_producao" }, { status: 403 });

  const clinicaId = await getClinicaId();
  if (!clinicaId) return NextResponse.json({ ok: false, error: "backend_unavailable" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as {
    pacienteId?: string;
    tipo?: string;
    referenciaId?: string;
  } | null;
  if (!body?.pacienteId || !body.tipo) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

  const resultado = await emitirEventoAutomacao({
    clinicaId,
    pacienteId: body.pacienteId,
    tipo: body.tipo,
    referenciaId: body.referenciaId ?? null,
  });

  return NextResponse.json({ ok: true, resultado });
}
