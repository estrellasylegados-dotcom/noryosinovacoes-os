import { siteConfig } from "@/lib/config";

export type FaqItem = { pergunta: string; resposta: string };

const horarioSabado = siteConfig.horarios.find((h) => h.dias === "Sábado")?.horario ?? "";
const horarioSemana = siteConfig.horarios.find((h) => h.dias === "Segunda a sexta")?.horario ?? "";

/**
 * FAQ compliance-safe (Resolução CFO-196/2019): sem promessa de resultado,
 * sem superlativo, sem depoimento de paciente. Pergunta sem resposta
 * confirmada (convênio, forma de pagamento) redireciona pro WhatsApp em vez
 * de expor `[PLACEHOLDER]` — ver clientes/odontominas/contexto.md. Endereço e
 * horário vêm de `siteConfig` — nunca duplicar o dado aqui.
 */
export const faq: FaqItem[] = [
  {
    pergunta: "Onde fica a OdontoMinas?",
    resposta: siteConfig.endereco.display,
  },
  {
    pergunta: "Como agendar uma avaliação?",
    resposta: "Pelo WhatsApp do site. O primeiro contato já encaminha pra um horário de avaliação com a equipe.",
  },
  {
    pergunta: "A clínica atende aos sábados?",
    resposta: `Sim, das ${horarioSabado}. De segunda a sexta o horário é das ${horarioSemana}.`,
  },
  {
    pergunta: "A OdontoMinas realiza implantes dentários?",
    resposta:
      "Sim. A implantodontia é uma das principais áreas de atuação da clínica, sempre com avaliação individual antes de qualquer indicação.",
  },
  {
    pergunta: "A clínica realiza atendimento ortodôntico?",
    resposta: "Sim, com acompanhamento contínuo ao longo do tratamento.",
  },
  {
    pergunta: "Como funciona a primeira avaliação?",
    resposta: "A Dra. Ariadna conhece o caso, realiza a avaliação clínica e, a partir disso, planeja o tratamento indicado.",
  },
  {
    pergunta: "É necessário fazer avaliação antes de um implante?",
    resposta: "Sim. Todo tratamento — implante incluso — começa com uma avaliação clínica individual.",
  },
  {
    pergunta: "Quais formas de pagamento são aceitas?",
    resposta: "Fale com a equipe pelo WhatsApp para confirmar as formas de pagamento disponíveis.",
  },
  {
    pergunta: "A clínica atende convênios?",
    resposta: "Fale com a equipe pelo WhatsApp para confirmar se o seu convênio é aceito.",
  },
];

/**
 * FAQ específico do Protocolo Correct Full Arch. Mesma regra de compliance
 * do array acima — nenhuma promessa de resultado, número fixo de implantes
 * ou prazo. Ver clientes/odontominas/contexto.md (§ Correct) antes de mudar
 * qualquer resposta aqui: nada além do que está confirmado publicamente.
 */
export const faqProtocolo: FaqItem[] = [
  {
    pergunta: "O que é uma reabilitação Full Arch?",
    resposta:
      "É uma abordagem de reabilitação oral que trata o arco dentário como um todo, sobre implantes, em vez de repor um dente por vez. A indicação depende da avaliação clínica de cada caso.",
  },
  {
    pergunta: "Quem pode ser avaliado para o Protocolo Correct?",
    resposta:
      "Pacientes com perda dentária extensa ou comprometimento significativo da arcada podem passar por uma avaliação para entender se a reabilitação de arco completo é indicada. A confirmação só acontece após exame clínico.",
  },
  {
    pergunta: "O tratamento é igual para todos os pacientes?",
    resposta:
      "Não. O planejamento é individual: parte das condições clínicas e anatômicas de cada paciente, avaliadas antes de qualquer indicação.",
  },
  {
    pergunta: "É necessário fazer exames antes da avaliação?",
    resposta:
      "A necessidade de exames de imagem e outros exames complementares é definida pela Dra. Ariadna durante a avaliação, conforme o caso.",
  },
  {
    pergunta: "Quantos implantes são utilizados no Protocolo Correct?",
    resposta:
      "O planejamento depende das condições clínicas e anatômicas de cada paciente. A quantidade e a distribuição dos implantes são definidas após avaliação profissional — não há um número padrão para todos os casos.",
  },
  {
    pergunta: "É possível sair com dentes no mesmo dia?",
    resposta:
      "Alguns protocolos implantossuportados podem permitir etapas provisórias mais rápidas em casos selecionados, mas isso depende de avaliação clínica, estabilidade dos implantes e planejamento individual — não é uma regra geral.",
  },
];
