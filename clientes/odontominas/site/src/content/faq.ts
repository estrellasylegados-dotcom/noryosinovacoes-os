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
