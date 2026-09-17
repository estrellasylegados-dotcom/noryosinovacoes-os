import { escreverLayoutEditor, gerarLayoutAutomatico } from "@/lib/fluxo-editor-layout";
import type { FluxoDefinicao, NoFluxo } from "@/lib/fluxo-tipos";

/**
 * "Sabor odontológico" da Fase 2b/3 sem mexer no motor: cada template só
 * combina os 6 tipos de nó já existentes (`fluxo-tipos.ts`) com texto/menus
 * pré-preenchidos pro contexto da clínica — cumpre a seção "Templates
 * odontológicos a construir" da visão original sem criar tipo de nó novo.
 *
 * O motor não tem ação explícita "transferir para humano" — os templates
 * usam `finalizar{motivo:"encaminhado_para_atendente"}`, que já devolve
 * `dono_conversa` pra `'humano'` exatamente como uma transferência real
 * (ver `processarPassoReivindicado`/`liberarControle` em
 * `fluxo-execucoes.ts`), só não aparece separado numa futura métrica de
 * "taxa de transferência".
 *
 * Templates que dependeriam de agenda real (Agendamento de verdade,
 * Paciente faltou com reagendamento automático) ficam de fora — só fazem
 * sentido quando o ControleODONTO estiver validado (ver
 * `src/lib/controle-odonto/capabilities.ts`); oferecer um template
 * "Agendamento" que na prática só finaliza com "vou te transferir" seria um
 * template fraco demais pra justificar a categoria.
 */

export type TemplateFluxo = { id: string; nome: string; descricao: string; gerarDefinicao: () => FluxoDefinicao };

function comLayoutAutomatico(nodes: NoFluxo[]): FluxoDefinicao {
  return { nodes, edges: [], config: escreverLayoutEditor({}, { posicoes: gerarLayoutAutomatico(nodes) }) };
}

export function definicaoPadrao(): FluxoDefinicao {
  return comLayoutAutomatico([
    { id: "inicio", tipo: "inicio", proximo: "fim" },
    { id: "fim", tipo: "finalizar" },
  ]);
}

function gerarAtendimentoInicial(): FluxoDefinicao {
  return comLayoutAutomatico([
    { id: "inicio", tipo: "inicio", proximo: "menu_principal" },
    {
      id: "menu_principal",
      tipo: "menu",
      texto:
        "Olá! Como posso te ajudar hoje?\n1 - Agendar avaliação\n2 - Tratamentos\n3 - Valores\n4 - Endereço e horário\n5 - Falar com um atendente",
      opcoes: [
        { valor: "1", rotulos: ["1", "agendar", "agendar avaliação", "avaliação"], proximo: "msg_agendar" },
        { valor: "2", rotulos: ["2", "tratamentos"], proximo: "msg_tratamentos" },
        { valor: "3", rotulos: ["3", "valores", "preço", "preco"], proximo: "msg_valores" },
        { valor: "4", rotulos: ["4", "endereço", "endereco", "horário", "horario"], proximo: "msg_endereco" },
        { valor: "5", rotulos: ["5", "atendente", "humano"], proximo: "fim_transferir" },
      ],
      maxTentativasInvalidas: 3,
      mensagemInvalida: "Não consegui identificar. Digite 1, 2, 3, 4 ou 5.",
      timeoutSegundos: 3600,
      proximoTimeout: "fim_transferir",
    },
    {
      id: "msg_agendar",
      tipo: "mensagem",
      texto: "Ótimo! Pra agendar sua avaliação, um atendente vai te chamar em instantes pra confirmar o melhor horário.",
      proximo: "fim_transferir",
    },
    {
      id: "msg_tratamentos",
      tipo: "mensagem",
      texto: "Trabalhamos com implantes e ortodontia. Posso te encaminhar pra um atendente explicar os detalhes.",
      proximo: "fim_auto",
    },
    {
      id: "msg_valores",
      tipo: "mensagem",
      texto: "Os valores variam de acordo com o tratamento e a avaliação clínica. Um atendente pode te passar uma estimativa.",
      proximo: "fim_transferir",
    },
    {
      id: "msg_endereco",
      tipo: "mensagem",
      texto: "Ficamos em Brazlândia-DF. Atendemos de segunda a sexta, das 8h às 18h, e sábado das 8h às 12h.",
      proximo: "fim_auto",
    },
    { id: "fim_auto", tipo: "finalizar", motivo: "atendimento_automatico_concluido" },
    { id: "fim_transferir", tipo: "finalizar", motivo: "encaminhado_para_atendente" },
  ]);
}

function gerarConfirmacaoConsulta(): FluxoDefinicao {
  return comLayoutAutomatico([
    { id: "inicio", tipo: "inicio", proximo: "menu_confirmar" },
    {
      id: "menu_confirmar",
      tipo: "menu",
      texto:
        "Olá, {primeiro_nome}! Sua consulta está marcada para {data_consulta} às {hora_consulta}.\n1 - Confirmar presença\n2 - Preciso reagendar\n3 - Preciso cancelar",
      opcoes: [
        { valor: "1", rotulos: ["1", "confirmar", "confirmo"], proximo: "msg_confirmado" },
        { valor: "2", rotulos: ["2", "reagendar"], proximo: "msg_reagendar" },
        { valor: "3", rotulos: ["3", "cancelar"], proximo: "msg_cancelado" },
      ],
      maxTentativasInvalidas: 3,
      mensagemInvalida: "Não consegui entender. Digite 1, 2 ou 3.",
      timeoutSegundos: 7200,
      proximoTimeout: "fim_sem_resposta",
    },
    { id: "msg_confirmado", tipo: "mensagem", texto: "Perfeito, sua presença está confirmada! Até lá.", proximo: "fim_confirmado" },
    {
      id: "msg_reagendar",
      tipo: "mensagem",
      texto: "Sem problemas. Um atendente vai entrar em contato pra encontrar um novo horário.",
      proximo: "fim_transferir",
    },
    {
      id: "msg_cancelado",
      tipo: "mensagem",
      texto: "Tudo bem, sua consulta foi cancelada. Se quiser remarcar no futuro, é só chamar a gente.",
      proximo: "fim_cancelado",
    },
    { id: "fim_confirmado", tipo: "finalizar", motivo: "consulta_confirmada" },
    { id: "fim_transferir", tipo: "finalizar", motivo: "encaminhado_para_atendente" },
    { id: "fim_cancelado", tipo: "finalizar", motivo: "consulta_cancelada_pelo_paciente" },
    { id: "fim_sem_resposta", tipo: "finalizar", motivo: "sem_resposta_confirmacao" },
  ]);
}

function gerarRecuperacaoReativacao(): FluxoDefinicao {
  return comLayoutAutomatico([
    { id: "inicio", tipo: "inicio", proximo: "msg_oferta" },
    {
      id: "msg_oferta",
      tipo: "mensagem",
      texto:
        "Olá, {primeiro_nome}! Notamos que você demonstrou interesse em nossos tratamentos. Ainda gostaria de agendar uma avaliação? É só responder esta mensagem.",
      proximo: "espera_resposta",
    },
    { id: "espera_resposta", tipo: "espera", duracaoSegundos: 86400, proximo: "verificar_resposta" },
    {
      id: "verificar_resposta",
      tipo: "condicao",
      variavel: "respondeu_reativacao",
      operador: "existe",
      seVerdadeiro: "fim_engajado",
      seFalso: "fim_sem_resposta",
    },
    { id: "fim_engajado", tipo: "finalizar", motivo: "encaminhado_para_atendente" },
    { id: "fim_sem_resposta", tipo: "finalizar", motivo: "sem_resposta_reativacao" },
  ]);
}

export const TEMPLATES_ODONTO: TemplateFluxo[] = [
  {
    id: "atendimento-inicial",
    nome: "Atendimento inicial",
    descricao: "Menu de boas-vindas (agendar, tratamentos, valores, endereço, falar com atendente).",
    gerarDefinicao: gerarAtendimentoInicial,
  },
  {
    id: "confirmacao-consulta",
    nome: "Confirmação de consulta",
    descricao:
      "Confirmar/reagendar/cancelar uma consulta marcada. Usa {data_consulta}/{hora_consulta} como ponto de partida — " +
      "o sistema ainda não preenche essas variáveis automaticamente, ajuste antes de publicar.",
    gerarDefinicao: gerarConfirmacaoConsulta,
  },
  {
    id: "recuperacao-reativacao",
    nome: "Recuperação / Reativação",
    descricao:
      "Mensagem de reengajamento pra quem parou de responder, com espera de 24h e checagem de resposta. " +
      "A condição usa uma variável de exemplo ({respondeu_reativacao}) — ajuste conforme a integração disponível.",
    gerarDefinicao: gerarRecuperacaoReativacao,
  },
];

export function buscarTemplate(id: string | null | undefined): TemplateFluxo | null {
  if (!id) return null;
  return TEMPLATES_ODONTO.find((t) => t.id === id) ?? null;
}

export function gerarDefinicaoInicial(templateId?: string | null): FluxoDefinicao {
  return buscarTemplate(templateId)?.gerarDefinicao() ?? definicaoPadrao();
}
