import { getSupabaseServerClient } from "@/lib/supabase";
import { iniciarExecucaoFluxo } from "@/lib/fluxo-execucoes";
import { obterOuCriarConversaDoPaciente } from "@/lib/conversas";
import { categoriaDoGatilho } from "@/lib/fluxo-gatilhos";

/**
 * Fase 3 (motor central de automação — ver _memoria/decisoes.md): ponte
 * entre um evento de NEGÓCIO (não webhook, não cron) e o motor de Fluxo de
 * Conversa. Qualquer outro módulo do sistema chama `emitirEventoAutomacao`
 * quando tiver certeza de que algo aconteceu — o motor decide sozinho se
 * existe fluxo compatível, se está ativo, e aplica idempotência.
 *
 * `atendimento_concluido` está mapeado aqui (ver fluxo-gatilhos.ts) mas
 * NENHUM módulo do CRM chama `emitirEventoAutomacao` com esse tipo ainda —
 * não existe hoje um estado confiável de "atendimento concluído" (nem
 * `respondido` nem `agendado` significam isso, ver _memoria/decisoes.md).
 * A única forma de emitir esse evento por enquanto é a rota de teste
 * controlada (src/app/api/automacao/eventos/testar/route.ts, admin +
 * fora-de-produção ou flag explícita) — nunca em produção sozinho.
 */

export type ResultadoEventoAutomacao =
  | { resultado: "execucao_iniciada"; execucaoId: string }
  | { resultado: "idempotencia_existente" }
  | { resultado: "fluxo_nao_encontrado" }
  | { resultado: "fluxo_inativo" }
  | { resultado: "dado_obrigatorio_ausente"; detalhe: string }
  | { resultado: "erro"; detalhe: string };

type SupabaseClient = NonNullable<ReturnType<typeof getSupabaseServerClient>>;

async function registrarEvento(
  supabase: SupabaseClient,
  input: {
    clinicaId: string;
    pacienteId: string | null;
    tipo: string;
    referenciaId?: string | null;
    fluxoId: string | null;
    execucaoId: string | null;
    resultado: string;
    detalhe?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from("automacao_eventos").insert({
    clinica_id: input.clinicaId,
    paciente_id: input.pacienteId,
    fluxo_id: input.fluxoId,
    execucao_id: input.execucaoId,
    evento_tipo: input.tipo,
    referencia_id: input.referenciaId ?? null,
    resultado: input.resultado,
    detalhe: input.detalhe ?? {},
  });
  if (error) {
    console.error("[fluxo-eventos-internos] registrar_evento_failed", JSON.stringify({ tipo: input.tipo, code: error.code ?? null }));
  }
}

export async function emitirEventoAutomacao(input: {
  clinicaId: string;
  pacienteId: string;
  tipo: string;
  referenciaId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<ResultadoEventoAutomacao> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { resultado: "erro", detalhe: "backend_unavailable" };

  if (categoriaDoGatilho(input.tipo) !== "interno") {
    return { resultado: "erro", detalhe: "tipo_nao_e_evento_interno" };
  }

  if (!input.referenciaId) {
    await registrarEvento(supabase, { ...input, fluxoId: null, execucaoId: null, resultado: "dado_obrigatorio_ausente", detalhe: { motivo: "referenciaId ausente" } });
    return { resultado: "dado_obrigatorio_ausente", detalhe: "referenciaId ausente" };
  }

  const { data: fluxos } = await supabase
    .from("fluxos")
    .select("id, status, pode_interromper_agente_ia")
    .eq("clinica_id", input.clinicaId)
    .eq("gatilho_tipo", input.tipo);

  const fluxoAtivo = (fluxos ?? []).find((f) => f.status === "ativo");
  if (!fluxoAtivo) {
    const resultado = (fluxos ?? []).length > 0 ? "fluxo_inativo" : "fluxo_nao_encontrado";
    await registrarEvento(supabase, { ...input, fluxoId: (fluxos ?? [])[0]?.id as string | undefined ?? null, execucaoId: null, resultado });
    return resultado === "fluxo_inativo" ? { resultado: "fluxo_inativo" } : { resultado: "fluxo_nao_encontrado" };
  }

  const conversaId = await obterOuCriarConversaDoPaciente(input.clinicaId, input.pacienteId);
  if (!conversaId) {
    await registrarEvento(supabase, { ...input, fluxoId: fluxoAtivo.id as string, execucaoId: null, resultado: "erro", detalhe: { motivo: "sem_conversa" } });
    return { resultado: "erro", detalhe: "sem_conversa" };
  }

  const dedupeKey = `${input.tipo}:${input.pacienteId}:${input.referenciaId}`;
  const resultado = await iniciarExecucaoFluxo(
    input.clinicaId,
    fluxoAtivo.id as string,
    conversaId,
    input.pacienteId,
    { tipo: input.tipo, refId: input.pacienteId, dedupeKey },
    Boolean(fluxoAtivo.pode_interromper_agente_ia)
  );

  if (!resultado.ok) {
    await registrarEvento(supabase, { ...input, fluxoId: fluxoAtivo.id as string, execucaoId: null, resultado: "erro", detalhe: { motivo: resultado.error ?? "desconhecido" } });
    return { resultado: "erro", detalhe: resultado.error ?? "desconhecido" };
  }
  if (resultado.error === "ja_existe") {
    await registrarEvento(supabase, { ...input, fluxoId: fluxoAtivo.id as string, execucaoId: null, resultado: "idempotencia_existente" });
    return { resultado: "idempotencia_existente" };
  }

  await registrarEvento(supabase, { ...input, fluxoId: fluxoAtivo.id as string, execucaoId: resultado.execucaoId ?? null, resultado: "execucao_iniciada" });
  return { resultado: "execucao_iniciada", execucaoId: resultado.execucaoId as string };
}
