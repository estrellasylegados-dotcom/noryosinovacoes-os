import { NextResponse } from "next/server";
import { getSessaoAtual } from "@/lib/sessao-servidor";
import { getClinicaId } from "@/lib/clinica";
import { emitirEventoAutomacao } from "@/lib/fluxo-eventos-internos";

export const runtime = "nodejs";

/**
 * Fase 3 (evolução arquitetural — ver _memoria/decisoes.md): rota de
 * validação CONTROLADA do mecanismo de eventos internos
 * (emitirEventoAutomacao) — não uma forma de simular qualquer automação em
 * produção à vontade. `atendimento_concluido` não tem origem real hoje (ver
 * fluxo-eventos-internos.ts) — esta rota é o único jeito de testar essa
 * categoria de gatilho antes de existir uma origem confiável.
 *
 * DUAS proteções, sempre as duas, em qualquer ambiente (nenhum bypass
 * implícito por NODE_ENV):
 *   1. sessão de admin;
 *   2. `ENABLE_AUTOMATION_EVENT_TEST_ROUTE=true` setado explicitamente —
 *      ausente ou qualquer valor diferente de "true" é tratado como
 *      desabilitado. Default (variável não setada) = desabilitada.
 *
 * Uso pretendido: habilitar a variável no Railway só durante uma validação
 * controlada, testar, e voltar `ENABLE_AUTOMATION_EVENT_TEST_ROUTE=false`
 * (ou remover a variável) logo em seguida — nunca deixar ligada
 * permanentemente em produção.
 *
 * PENDÊNCIA (ver relatório de entrega da Fase 3): decidir com o Rafael se
 * esta rota deve ser removida do código depois que a Fase 3 estiver
 * validada, ou permanecer atrás da flag indefinidamente.
 */
export async function POST(request: Request) {
  const sessao = await getSessaoAtual();
  if (sessao?.papel !== "admin") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  if (process.env.ENABLE_AUTOMATION_EVENT_TEST_ROUTE !== "true") {
    return NextResponse.json({ ok: false, error: "rota_indisponivel" }, { status: 403 });
  }

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
