import { getSupabaseServerClient } from "@/lib/supabase";
import { enviarMensagemWhatsapp } from "@/lib/evolution-send";
import { extrairNomeEmbutido, type NomeEmbutido } from "@/lib/conversas";
import { isStatusValido, STATUS_RESOLVIDOS, type StatusConversa } from "@/lib/status";
import { buscarClinicaAtual } from "@/lib/clinica";

/**
 * Fase 5 do CRM: automação de reativação de paciente inativo. Regra de
 * negócio pura em `selecionarCandidatos`/`montarMensagemReativacao`
 * (testável isolada, mesmo padrão de funil.ts/resumo.ts); orquestração
 * (ler Supabase, mandar WhatsApp, gravar) em `executarReativacao`, chamada
 * pela rota src/app/api/cron/reativacao.
 *
 * Acima disso, uma conversa resolvida (respondido/agendado/perdido) sem
 * mensagem nova vira candidata a reativação — pensado como "esfriou de
 * verdade", não só uma pausa curta no atendimento.
 */
export const LIMITE_INATIVIDADE_MS = 30 * 24 * 60 * 60 * 1000;

export type ConversaParaReativacao = {
  id: string;
  telefone: string;
  pacienteId: string | null;
  pacienteNome: string | null;
  status: StatusConversa;
  ultimaMensagemEm: string | null;
  ultimaReativacaoEm: string | null;
};

/**
 * V1 manda a reativação 1x só por conversa (`ultimaReativacaoEm` vira o
 * trinco): sem cadência de repetição automática ainda — reabrir isso é
 * decisão de negócio pra quando o piloto validar o primeiro disparo.
 * Também não distingue "agendado" com consulta futura de verdade, porque
 * `consultas` ainda não recebe escrita de ninguém (ver andamento.md); quando
 * receber, filtrar quem tem consulta futura marcada antes de reativar.
 */
export function selecionarCandidatos(
  conversas: ConversaParaReativacao[],
  agoraMs: number
): ConversaParaReativacao[] {
  return conversas.filter((c) => {
    if (!STATUS_RESOLVIDOS.includes(c.status)) return false;
    if (c.ultimaReativacaoEm) return false;
    if (!c.ultimaMensagemEm) return false;
    return agoraMs - new Date(c.ultimaMensagemEm).getTime() > LIMITE_INATIVIDADE_MS;
  });
}

/** Reaproveitado por mensagens-salvas.ts pra resolver {primeiro_nome} — não duplicar. */
export function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0];
}

/**
 * Sem promessa de resultado, sem superlativo — check-in simples (Resolução
 * CFO-196/2019, ver contexto.md). `clinicaNome` tem valor padrão pra não
 * quebrar chamador que ainda não busca a clínica (branding dinâmico, Fase 3
 * — ver _memoria/decisoes.md); `executarReativacao` sempre passa o nome real.
 */
export function montarMensagemReativacao(pacienteNome: string | null, clinicaNome: string = "nossa clínica"): string {
  const saudacao = pacienteNome ? `Oi, ${primeiroNome(pacienteNome)}!` : "Oi!";
  return (
    `${saudacao} Aqui é da ${clinicaNome} 😊 Faz um tempo que a gente não conversa — ` +
    `ainda posso te ajudar com alguma coisa? Se quiser retomar, é só responder por aqui.`
  );
}

export type ResultadoReativacao = {
  candidatos: number;
  enviados: number;
  falhas: number;
  detalhes: { telefone: string; ok: boolean; error?: string }[];
};

export async function executarReativacao(clinicaId: string): Promise<ResultadoReativacao> {
  const vazio: ResultadoReativacao = { candidatos: 0, enviados: 0, falhas: 0, detalhes: [] };

  const supabase = getSupabaseServerClient();
  if (!supabase) return vazio;

  const { data, error } = await supabase
    .from("conversas")
    .select("id, telefone, status, paciente_id, ultima_mensagem_em, ultima_reativacao_em, pacientes(nome)")
    .eq("clinica_id", clinicaId);

  if (error || !data) {
    console.error("[reativacao] listar_failed", JSON.stringify({ code: error?.code ?? null }));
    return vazio;
  }

  const conversas: ConversaParaReativacao[] = data.map((c) => ({
    id: c.id as string,
    telefone: c.telefone as string,
    pacienteId: (c.paciente_id as string | null | undefined) ?? null,
    pacienteNome: extrairNomeEmbutido(c.pacientes as NomeEmbutido),
    status: (isStatusValido(c.status as string) ? c.status : "novo") as StatusConversa,
    ultimaMensagemEm: c.ultima_mensagem_em as string | null,
    ultimaReativacaoEm: c.ultima_reativacao_em as string | null,
  }));

  const candidatos = selecionarCandidatos(conversas, Date.now());
  const detalhes: ResultadoReativacao["detalhes"] = [];
  let enviados = 0;

  const clinicaAtual = await buscarClinicaAtual();
  const clinicaNome = clinicaAtual?.nome ?? "nossa clínica";

  for (const candidato of candidatos) {
    const texto = montarMensagemReativacao(candidato.pacienteNome, clinicaNome);
    const envio = await enviarMensagemWhatsapp(candidato.telefone, texto);

    if (envio.ok) {
      const agora = new Date().toISOString();

      await supabase
        .from("conversas")
        .update({ ultima_reativacao_em: agora, ultima_mensagem_em: agora, updated_at: agora })
        .eq("id", candidato.id);

      const { error: mensagemError } = await supabase.from("mensagens").insert({
        clinica_id: clinicaId,
        conversa_id: candidato.id,
        direcao: "enviada",
        tipo: "texto",
        conteudo: texto,
        evolution_message_id: envio.mensagemId ?? null,
        timestamp_whatsapp: agora,
      });
      // unique(evolution_message_id): se o webhook já espelhou esta mesma
      // mensagem antes deste insert rodar, 23505 é esperado, não erro real.
      if (mensagemError && mensagemError.code !== "23505") {
        console.error(
          "[reativacao] insert_mensagem_failed",
          JSON.stringify({ conversaId: candidato.id, code: mensagemError.code ?? null })
        );
      }

      enviados++;
    } else {
      console.error(
        "[reativacao] envio_failed",
        JSON.stringify({ conversaId: candidato.id, error: envio.error ?? null })
      );
    }

    detalhes.push({ telefone: candidato.telefone, ok: envio.ok, error: envio.error });
  }

  return { candidatos: candidatos.length, enviados, falhas: candidatos.length - enviados, detalhes };
}
