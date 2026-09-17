import { buscarModelo, gerarResposta, type MensagemHistorico } from "@/lib/ia-provedores";
import { adicionarEtiquetaConversa, buscarOuCriarEtiqueta, removerEtiquetaConversa } from "@/lib/etiquetas";
import { getSupabaseServerClient } from "@/lib/supabase";
import { registrarEventoCampanha } from "@/lib/campanha-eventos";
import type { AgenteIA } from "@/lib/agentes";

/**
 * "Qualificação Automática de Leads" (aba nova do print da RoiZap, deixada
 * de fora na v12 por falta de critério — ver decisão 2026-09-16 em
 * `_memoria/decisoes.md`). Critério fechado com o Rafael: escala fixa
 * Quente/Morno/Frio (não um catálogo livre por clínica), reavaliada depois
 * de cada resposta do agente — reaproveita o mesmo modelo/provider do
 * agente, uma chamada de classificação além da chamada que gera a resposta.
 *
 * A etiqueta é a temperatura ATUAL do lead, não um histórico: aplicar uma
 * remove as outras duas da conversa, pra nunca mostrar "Quente" e "Frio" ao
 * mesmo tempo. `classificarQualificacao` é a chamada de IA (pode falhar,
 * volta `null`); `aplicarQualificacaoAutomatica` é quem lê/escreve etiqueta
 * — as duas são chamadas por `responderComoAgente` (src/lib/agentes.ts),
 * sempre dentro de um try/catch que nunca deixa essa etapa derrubar o envio
 * da resposta, que já aconteceu antes dela.
 */

export type Classificacao = "quente" | "morno" | "frio";

const ETIQUETA_POR_CLASSIFICACAO: Record<Classificacao, { nome: string; cor: string }> = {
  quente: { nome: "Lead Quente", cor: "#dc2626" },
  morno: { nome: "Lead Morno", cor: "#d97706" },
  frio: { nome: "Lead Frio", cor: "#2563eb" },
};

const PROMPT_CLASSIFICACAO =
  "Você classifica o interesse de um paciente numa conversa de WhatsApp com uma clínica odontológica, " +
  "só com base no histórico abaixo. Responda com exatamente uma palavra, sem explicação nenhuma: " +
  "QUENTE se o paciente mostra intenção clara de agendar ou já pediu horário/preço/disponibilidade; " +
  "MORNO se está interessado mas ainda tirando dúvida, sem compromisso ainda; " +
  "FRIO se demonstrou desinteresse, pediu pra não ser contatado, ou parou de responder depois de uma recusa.";

/** Extrai QUENTE/MORNO/FRIO da resposta livre da IA. Pura e testável isolada, mesmo padrão de funil.ts. */
export function parseClassificacao(textoBruto: string): Classificacao | null {
  const texto = textoBruto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (texto.includes("quente")) return "quente";
  if (texto.includes("morno")) return "morno";
  if (texto.includes("frio")) return "frio";
  return null;
}

/** Chamada de IA que classifica — mesmo provider/modelo do agente, nunca lança (volta null em qualquer falha). */
export async function classificarQualificacao(
  agente: Pick<AgenteIA, "provider" | "modelo">,
  historico: MensagemHistorico[],
  mensagemAtual: string
): Promise<Classificacao | null> {
  const modelo = buscarModelo(agente.provider, agente.modelo);
  if (!modelo) return null;

  const resposta = await gerarResposta(modelo, {
    promptSistema: PROMPT_CLASSIFICACAO,
    historico,
    mensagem: mensagemAtual,
    temperatura: 0,
    maxTokens: 10,
  });
  if (!resposta.ok || !resposta.texto) return null;

  return parseClassificacao(resposta.texto);
}

/**
 * Garante as 3 etiquetas da escala nesta clínica (cria a que faltar,
 * reaproveita se já existir uma com o mesmo nome) e aplica só a que bate com
 * `classificacao`, removendo as outras duas da conversa.
 */
export async function aplicarQualificacaoAutomatica(
  clinicaId: string,
  conversaId: string,
  classificacao: Classificacao
): Promise<void> {
  const entradas = Object.entries(ETIQUETA_POR_CLASSIFICACAO) as [Classificacao, { nome: string; cor: string }][];

  const etiquetas = await Promise.all(
    entradas.map(async ([chave, { nome, cor }]) => {
      const resultado = await buscarOuCriarEtiqueta(clinicaId, nome, cor);
      return { chave, id: resultado.etiqueta?.id ?? null };
    })
  );

  const alvo = etiquetas.find((e) => e.chave === classificacao);
  if (!alvo?.id) {
    console.error("[agentes-qualificacao] etiqueta_nao_disponivel", JSON.stringify({ conversaId, classificacao }));
    return;
  }

  await Promise.all(
    etiquetas.filter((e) => e.chave !== classificacao && e.id).map((e) => removerEtiquetaConversa(conversaId, e.id as string))
  );

  await adicionarEtiquetaConversa(clinicaId, conversaId, alvo.id);

  // Campanhas: "Quente" é o marco `qualified_lead` do funil — só quando o
  // paciente desta conversa tem origem por campanha. Idempotente (unique
  // key), isolado: nunca deve derrubar a qualificação em si.
  if (classificacao === "quente") {
    try {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        const { data: conversa } = await supabase.from("conversas").select("paciente_id").eq("id", conversaId).maybeSingle();
        const pacienteId = (conversa?.paciente_id as string | null) ?? null;
        if (pacienteId) {
          const { data: paciente } = await supabase.from("pacientes").select("campanha_id").eq("id", pacienteId).maybeSingle();
          const campanhaId = (paciente?.campanha_id as string | null) ?? null;
          if (campanhaId) {
            await registrarEventoCampanha(clinicaId, campanhaId, "qualified_lead", { pacienteId, conversaId });
          }
        }
      }
    } catch (e) {
      console.error("[agentes-qualificacao] evento_campanha_failed", JSON.stringify({ conversaId, message: (e as Error).message }));
    }
  }
}
